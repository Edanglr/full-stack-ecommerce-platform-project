// backend/src/routes/orderRoutes.js
import express from "express";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import User from "../models/User.js";

import { generateTrackingCode } from "../utils/trackingCode.js";
import { requireAuth, requireManager, requireRole } from "../middleware/auth.js";
import { mockBankCharge } from "../utils/mockBank.js";
import { generateInvoicePdf } from "../utils/invoice.js";
import { sendInvoiceEmail } from "../utils/email.js";

const router = express.Router();

/**
 * CREATE ORDER (customer)
 * POST /api/orders
 */
router.post("/", requireAuth, async (req, res) => {
  try {
    const { items, deliveryAddress } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res
        .status(400)
        .json({ message: "No items provided in the order." });
    }

    // 1) Stock check
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

    // 2) Decrease stock
    for (const item of items) {
      const sizeKey = item.size;
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { [`sizes.${sizeKey}`]: -item.quantity },
      });
    }

    // 3) Total amount
    const totalAmount = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    // 4) Payment
    const paymentResult = await mockBankCharge({
      amount: totalAmount,
      user: req.user,
    });

    if (!paymentResult || !paymentResult.success) {
      console.error("PAYMENT FAILED:", paymentResult);
      return res
        .status(402)
        .json({ message: "Payment failed. Please try again." });
    }

    // 5) Tracking code
    const trackingCode = generateTrackingCode();

    // 6) Create order
    const newOrder = await Order.create({
      user: req.user.id,
      items, // MUST include productId, name, size, quantity, price, imageUrl
      totalAmount,
      trackingCode,
      shippingStatus: "Processing",
      shippingHistory: [
        {
          status: "Order received",
          date: new Date(),
        },
      ],
      paymentStatus: "Paid",
      paymentDetails: {
        transactionId: paymentResult.transactionId || "",
        authCode: paymentResult.authCode || "",
      },
      deliveryAddress: deliveryAddress || "",
      isCompleted: false,
    });

    // Invoice + email
    const user = await User.findById(req.user.id).lean();

    if (!user) {
      console.warn(
        "Order created but user not found for invoice/email:",
        req.user.id
      );
    } else {
      try {
        const { invoiceNumber, pdfPath } = await generateInvoicePdf({
          order: newOrder,
          user,
        });

        newOrder.invoiceNumber = invoiceNumber;
        newOrder.invoicePdfPath = pdfPath;
        await newOrder.save();

        if (user.email) {
          try {
            await sendInvoiceEmail({ to: user.email, pdfPath });
          } catch (emailErr) {
            console.error("EMAIL SEND ERROR:", emailErr);
          }
        } else {
          console.warn(
            "User email missing, cannot send invoice email for user:",
            user._id
          );
        }
      } catch (invoiceErr) {
        console.error("INVOICE GENERATION ERROR:", invoiceErr);
      }
    }

    console.log("NEW ORDER CREATED:", {
      id: newOrder._id.toString(),
      trackingCode: newOrder.trackingCode,
      totalAmount: newOrder.totalAmount,
      user: req.user.id,
    });

    // Shipping address info (for invoice response)
    const name =
      (user &&
        (user.name ||
          `${user.firstName || ""} ${user.lastName || ""}`.trim())) ||
      "Customer";
    const address =
      (user && (user.address || user.shippingAddress)) ||
      newOrder.deliveryAddress ||
      "";
    const city = (user && user.city) || "";
    const postalCode = (user && (user.postalCode || user.zip)) || "";

    return res.status(201).json({
      message: "Order created and paid successfully.",
      orderId: newOrder._id,
      trackingCode: newOrder.trackingCode,
      invoice: {
        invoiceNumber: newOrder.invoiceNumber || "",
        totalAmount: newOrder.totalAmount,
        createdAt: newOrder.createdAt,
        items: newOrder.items,
        trackingCode: newOrder.trackingCode,
        shippingAddress: {
          name,
          address,
          city,
          postalCode,
        },
      },
    });
  } catch (err) {
    console.error("ORDER ERROR:", err);
    return res
      .status(500)
      .json({ message: "Server error while creating order." });
  }
});

/**
 * ✅ CUSTOMER ORDER HISTORY
 * GET /api/orders/my
 *
 * FIX: formatted response yüzünden trackingCode / shippingStatus / totalAmount
 * ve items.* alanları kaybolmasın diye FULL order döndürüyoruz.
 */
router.get("/my", requireAuth, async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .lean();

    return res.json(orders || []);
  } catch (err) {
    console.error("ORDER FETCH ERROR:", err);
    return res.status(500).json({ message: "Order fetch error" });
  }
});

/**
 * 🔥 ADMIN / SUPPORT – CUSTOMER ORDERS
 * GET /api/orders/by-user/:userId
 * -> supportAgent + salesManager + productManager
 * formatted + imageUrl garantisi
 */
router.get(
  "/by-user/:userId",
  requireRole("supportAgent", "salesManager", "productManager"),
  async (req, res) => {
    try {
      const { userId } = req.params;

      const orders = await Order.find({ user: userId })
        .populate({
          path: "items.productId",
          select: "name image imageUrl price",
        })
        .sort({ createdAt: -1 })
        .lean();

      const formatted = orders.map((order) => ({
        _id: order._id,
        orderCode: order._id.toString().slice(-6).toUpperCase(),
        status: order.shippingStatus || "Processing",
        totalPrice: order.totalAmount,
        createdAt: order.createdAt,
        items: (order.items || []).map((i) => ({
          name: i.productId?.name || i.name || "Product",
          imageUrl:
            i.productId?.imageUrl ||
            i.productId?.image ||
            i.imageUrl ||
            "https://via.placeholder.com/80?text=No+Image",
          price: i.price,
          quantity: i.quantity,
          size: i.size || "-",
        })),
      }));

      return res.json(formatted);
    } catch (err) {
      console.error("GET /orders/by-user error:", err);
      return res.status(500).json({ message: "Cannot fetch customer orders." });
    }
  }
);

/**
 * INVOICE DETAILS
 * GET /api/orders/:id/invoice
 */
router.get("/:id/invoice", requireAuth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).lean();

    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    if (order.user.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ message: "Not authorized to view this invoice." });
    }

    const user = await User.findById(req.user.id).lean();

    const name =
      (user &&
        (user.name ||
          `${user.firstName || ""} ${user.lastName || ""}`.trim())) ||
      "Customer";
    const address =
      (user && (user.address || user.shippingAddress)) ||
      order.deliveryAddress ||
      "";
    const city = (user && user.city) || "";
    const postalCode = (user && (user.postalCode || user.zip)) || "";

    return res.json({
      invoice: {
        invoiceNumber: order.invoiceNumber || "",
        totalAmount: order.totalAmount || 0,
        createdAt: order.createdAt,
        items: order.items || [],
        trackingCode: order.trackingCode,
        shippingAddress: {
          name,
          address,
          city,
          postalCode,
        },
      },
    });
  } catch (err) {
    console.error("GET /api/orders/:id/invoice error:", err);
    return res.status(500).json({ message: "Invoice fetch error." });
  }
});

/**
 * UPDATE SHIPPING STATUS
 * PUT /api/orders/:id/status
 * -> productManager (manager legacy geçer)
 * allowed: v1 + v2 birleşti (Shipped eklendi)
 */
router.put("/:id/status", requireRole("productManager"), async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ["Processing", "In-transit", "Delivered", "Shipped"];

    if (!allowed.includes(status)) {
      return res.status(400).json({ message: "Invalid status value." });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    order.shippingStatus = status;
    order.shippingHistory = order.shippingHistory || [];
    order.shippingHistory.push({ status, date: new Date() });

    // Delivered ise tamamlandı
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
 * TRACK ORDER BY TRACKING CODE
 * GET /api/orders/track/:trackingCode
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
router.get(
  "/admin/deliveries",
  requireRole("productManager"),
  async (_req, res) => {
    try {
      const orders = await Order.find({})
        .populate("user", "name email")
        .lean()
        .sort({ createdAt: -1 });

      const deliveryList = orders.flatMap((order) =>
        (order.items || []).map((item) => ({
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
  }
);

/**
 * GET /api/orders/admin/invoices
 * -> salesManager + productManager (manager legacy geçer)
 */
router.get(
  "/admin/invoices",
  requireRole("salesManager", "productManager"),
  async (_req, res) => {
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
  }
);

export default router;
