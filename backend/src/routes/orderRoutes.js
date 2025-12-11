// backend/src/routes/orderRoutes.js
import express from "express";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import User from "../models/User.js";

import { generateTrackingCode } from "../utils/trackingCode.js";
import { generateInvoicePdf } from "../utils/invoice.js";
import { sendInvoiceEmail } from "../utils/email.js";
import { requireAuth, requireManager } from "../middleware/auth.js";

const router = express.Router();

/**
 * CREATE ORDER (POST /api/orders)
 */
router.post("/", requireAuth, async (req, res) => {
  try {
    const { items, deliveryAddress } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res
        .status(400)
        .json({ message: "No items provided in the order." });
    }

    // 1) Stok kontrolü (ürün + beden)
    for (const item of items) {
      const product = await Product.findById(item.productId);

      if (!product) {
        return res
          .status(404)
          .json({ message: `Product not found: ${item.productId}` });
      }

      if (!item.size) {
        return res
          .status(400)
          .json({ message: `Size is required for product ${product.name}` });
      }

      const sizeKey = item.size;
      const sizes = product.sizes || {};
      const currentStock = sizes[sizeKey] ?? 0;

      if (currentStock < item.quantity) {
        return res.status(400).json({
          message: `Not enough stock for ${product.name} (size ${sizeKey}). Available: ${currentStock}`,
        });
      }
    }

    // 2) Stok düşme
    for (const item of items) {
      const sizeKey = item.size;
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { [`sizes.${sizeKey}`]: -item.quantity },
      });
    }

    // 3) Toplam tutar
    const totalAmount = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    // 4) Takip kodu
    const trackingCode = generateTrackingCode();

    // 5) Siparişi kaydet
    const newOrder = await Order.create({
      user: req.user.id,
      items,
      totalAmount,
      trackingCode,
      shippingStatus: "Processing",
      shippingHistory: [
        {
          status: "Order received",
          date: new Date(),
        },
      ],
      deliveryAddress: deliveryAddress || "",
      isCompleted: false,
    });

    console.log("NEW ORDER CREATED:", {
      id: newOrder._id.toString(),
      trackingCode: newOrder.trackingCode,
      totalAmount: newOrder.totalAmount,
      user: req.user.id,
    });

    // 6) Kullanıcı bilgisini çek (fatura ve mail için)
    let userDoc = null;
    try {
      userDoc = await User.findById(req.user.id).lean();
    } catch (e) {
      console.error("Could not load user for invoice:", e);
    }

    const targetEmail =
      userDoc?.email || req.user.email || req.body.email || null;

    // 7) Fatura PDF üret + e-posta ile gönder
    try {
      const { pdfPath } = await generateInvoicePdf({
        order: newOrder,
        user: userDoc || {},
      });

      if (targetEmail) {
        await sendInvoiceEmail({
          to: targetEmail,
          pdfPath,
        });
        console.log("Invoice email sent to:", targetEmail);
      } else {
        console.warn(
          "No email address found for invoice; skipping email sending."
        );
      }
    } catch (invoiceErr) {
      // ÖNEMLİ: Burada hata olsa bile sipariş başarılı kalsın,
      // sadece log atalım. Böylece sen "sipariş oluşmadı" problemi yaşamazsın.
      console.error("INVOICE / EMAIL ERROR (order created, mail failed):", invoiceErr);
    }

    return res.status(201).json({
      message: "Order created successfully.",
      orderId: newOrder._id,
      trackingCode: newOrder.trackingCode,
    });
  } catch (err) {
    console.error("ORDER ERROR:", err);
    return res
      .status(500)
      .json({ message: "Server error while creating order." });
  }
});

/**
 * GET /api/orders/my
 * -> login kullanıcının tüm siparişleri (order history)
 */
router.get("/my", requireAuth, async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user.id })
      .populate("items.productId")
      .sort({ createdAt: -1 })
      .lean();

    return res.json(orders);
  } catch (err) {
    console.error("GET /api/orders/my error:", err);
    return res
      .status(500)
      .json({ message: "Error while fetching your orders." });
  }
});

/**
 * UPDATE STATUS (PUT /api/orders/:id/status)
 * body: { status: "Processing" | "In-transit" | "Delivered" }
 * -> sadece manager
 */
router.put("/:id/status", requireManager, async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ["Processing", "In-transit", "Delivered"];

    if (!allowed.includes(status)) {
      return res.status(400).json({ message: "Invalid status value." });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    order.shippingStatus = status;
    order.shippingHistory.push({
      status,
      date: new Date(),
    });

    // ⭐ Delivered ise completed true olsun
    order.isCompleted = status === "Delivered";

    await order.save();

    return res.json({
      message: "Order status updated.",
      order,
    });
  } catch (err) {
    console.error("PUT /api/orders/:id/status error:", err);
    return res
      .status(500)
      .json({ message: "Error while updating order status." });
  }
});

/**
 * TRACK ORDER (GET /api/orders/track/:trackingCode)
 */
router.get("/track/:trackingCode", async (req, res) => {
  try {
    const { trackingCode } = req.params;

    const order = await Order.findOne({ trackingCode });

    if (!order) {
      return res.status(404).json({ message: "Tracking code not found." });
    }

    return res.status(200).json({
      trackingCode: order.trackingCode,
      shippingStatus: order.shippingStatus,
      shippingHistory: order.shippingHistory,
      items: order.items,
      totalAmount: order.totalAmount,
      createdAt: order.createdAt,
    });
  } catch (err) {
    console.error("TRACKING ERROR:", err);
    return res
      .status(500)
      .json({ message: "Server error while retrieving tracking info." });
  }
});

/**
 * GET /api/orders/admin/deliveries
 * -> product manager / delivery department view
 */
router.get("/admin/deliveries", requireManager, async (_req, res) => {
  try {
    const orders = await Order.find({})
      .populate("user", "name email")
      .lean()
      .sort({ createdAt: -1 });

    // Her order item için ayrı delivery satırı
    const deliveryList = orders.flatMap((order) =>
      order.items.map((item) => ({
        deliveryId: order._id,
        customerId: order.user?._id || null,
        customerName: order.user?.name || order.user?.email || "Unknown",
        productId: item.productId,
        productName: item.name,
        quantity: item.quantity,
        totalPrice: item.price * item.quantity,
        deliveryAddress: order.deliveryAddress || "Not specified",
        shippingStatus: order.shippingStatus,
        completed: !!order.isCompleted,
        trackingCode: order.trackingCode,
        createdAt: order.createdAt,
      }))
    );

    return res.json(deliveryList);
  } catch (err) {
    console.error("GET /api/orders/admin/deliveries error:", err);
    return res
      .status(500)
      .json({ message: "Error while fetching delivery list." });
  }
});

/**
 * GET /api/orders/admin/invoices
 * -> invoices view for product manager
 */
router.get("/admin/invoices", requireManager, async (_req, res) => {
  try {
    const orders = await Order.find({})
      .populate("user", "name email")
      .lean()
      .sort({ createdAt: -1 });

    const invoices = orders.map((order) => ({
      invoiceId: order._id,
      customerId: order.user?._id || null,
      customerName: order.user?.name || order.user?.email || "Unknown",
      items: order.items,
      totalAmount: order.totalAmount,
      deliveryAddress: order.deliveryAddress || "Not specified",
      trackingCode: order.trackingCode,
      shippingStatus: order.shippingStatus,
      createdAt: order.createdAt,
    }));

    return res.json(invoices);
  } catch (err) {
    console.error("GET /api/orders/admin/invoices error:", err);
    return res
      .status(500)
      .json({ message: "Error while fetching invoices." });
  }
});

export default router;
