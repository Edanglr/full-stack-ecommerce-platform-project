import express from "express";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import User from "../models/User.js";

import path from "path";
import fs from "fs";

import { generateTrackingCode } from "../utils/trackingCode.js";
import { requireAuth, requireManager, requireRole } from "../middleware/auth.js";
import { mockBankCharge } from "../utils/mockBank.js";
import { generateInvoicePdf } from "../utils/invoice.js";
import { sendInvoiceEmail } from "../utils/email.js";

const router = express.Router();

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const canAccessAnyOrder = (role) =>
  role === "salesManager" || role === "productManager" || role === "supportAgent" || role === "manager";

const buildShippingAddress = (user, order) => ({
  name: user?.name || "Customer",
  address: user?.address || order?.deliveryAddress || "",
  city: user?.city || "",
  postalCode: user?.postalCode || user?.zip || "",
});

// 1) Yeni Sipariş Oluşturma
router.post("/", requireAuth, async (req, res) => {
  try {
    const { items, deliveryAddress } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "No items provided in the order." });
    }

    const productById = new Map();

    // Stock check.
    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product) return res.status(404).json({ message: `Product not found: ${item.productId}` });
      if (!item.size) return res.status(400).json({ message: `Size is required for product ${product.name}` });

      productById.set(String(item.productId), product);

      const sizeKey = item.size;
      const sizes = product.sizes || {};
      const currentStock = sizes[sizeKey] ?? 0;

      if (currentStock < item.quantity) {
        return res.status(400).json({
          message: `Not enough stock for ${product.name} (size ${sizeKey}). Available: ${currentStock}`,
        });
      }
    }

    // Normalize items and compute purchase-time snapshots on the server.
    const normalizedItems = items.map((item) => {
      const product = productById.get(String(item.productId));

      const qty = Number(item.quantity) || 0;

      const listPrice =
        product.basePrice != null
          ? Number(product.basePrice)
          : (product.originalPrice != null ? Number(product.originalPrice) : Number(product.price));

      const discountRate = Number(product.discountRate) || 0; // 0..1
      const unitPrice = round2(Math.max(0, listPrice * (1 - discountRate)));

      const unitCost = product.cost != null ? Number(product.cost) : null;

      return {
        productId: item.productId,
        name: item.name || product.name,
        size: item.size || "",
        quantity: qty,

        // Kept for compatibility; always set from server effective price.
        price: unitPrice,

        imageUrl: item.imageUrl || product.imageUrl || "",

        unitPriceAtPurchase: unitPrice,
        unitListPriceAtPurchase: round2(listPrice),
        discountRateAtPurchase: discountRate,
        unitCostAtPurchase: unitCost,
        discountCampaignId: null,
      };
    });

    // Stock decrease.
    for (const item of normalizedItems) {
      const sizeKey = item.size;
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { [`sizes.${sizeKey}`]: -item.quantity },
      });
    }

    // Totals based on snapshots.
    const subtotalAtPurchase = round2(
      normalizedItems.reduce(
        (sum, it) => sum + (it.unitListPriceAtPurchase ?? it.price) * it.quantity,
        0
      )
    );

    const totalAtPurchase = round2(
      normalizedItems.reduce(
        (sum, it) => sum + (it.unitPriceAtPurchase ?? it.price) * it.quantity,
        0
      )
    );

    const discountTotalAtPurchase = round2(Math.max(0, subtotalAtPurchase - totalAtPurchase));

    const profitRaw = normalizedItems.reduce((sum, it) => {
      if (it.unitCostAtPurchase == null) return sum;
      return sum + (Number(it.unitPriceAtPurchase ?? it.price) - Number(it.unitCostAtPurchase)) * it.quantity;
    }, 0);

    const profitAtPurchase =
      normalizedItems.some((it) => it.unitCostAtPurchase == null) ? null : round2(profitRaw);

    // Keep old totalAmount consistent for existing UI.
    const totalAmount = totalAtPurchase;

    // Mock bankadan ödeme al
    const paymentResult = await mockBankCharge({ amount: totalAmount, user: req.user });
    if (!paymentResult || !paymentResult.success) {
      return res.status(402).json({ message: "Payment failed. Please try again." });
    }

    const trackingCode = generateTrackingCode();

    const newOrder = await Order.create({
      user: req.user.id,
      items: normalizedItems,
      totalAmount,

      subtotalAtPurchase,
      discountTotalAtPurchase,
      totalAtPurchase,
      profitAtPurchase,

      trackingCode,
      shippingStatus: "Processing",
      shippingHistory: [{ status: "Order received", date: new Date() }],

      paymentStatus: "Paid",
      paymentDetails: {
        transactionId: paymentResult.transactionId || "",
        authCode: paymentResult.authCode || "",
      },

      deliveryAddress: deliveryAddress || "",
      isCompleted: false,
    });

    const user = await User.findById(req.user.id).lean();
    if (user) {
      try {
        const { invoiceNumber, pdfPath } = await generateInvoicePdf({ order: newOrder, user });
        newOrder.invoiceNumber = invoiceNumber;
        newOrder.invoicePdfPath = pdfPath;
        await newOrder.save();
        if (user.email) await sendInvoiceEmail({ to: user.email, pdfPath });
      } catch (invoiceErr) {
        console.error("INVOICE ERROR:", invoiceErr);
      }
    }

    return res.status(201).json({
      message: "Order created and paid successfully.",
      orderId: newOrder._id,
      trackingCode: newOrder.trackingCode,
      invoice: {
        invoiceNumber: newOrder.invoiceNumber || "",
        totalAmount: newOrder.totalAtPurchase ?? newOrder.totalAmount,
        createdAt: newOrder.createdAt,
        items: newOrder.items,
        trackingCode: newOrder.trackingCode,
        shippingAddress: buildShippingAddress(user, newOrder),
      },
    });
  } catch (err) {
    console.error("ORDER ERROR:", err);
    return res.status(500).json({ message: "Server error while creating order." });
  }
});

// 2) Kullanıcının Kendi Siparişlerini Çekmesi
router.get("/my", requireAuth, async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user.id })
      .populate({ path: "items.productId", select: "name imageUrl image price" })
      .sort({ createdAt: -1 })
      .lean();

    const formatted = orders.map((order) => ({
      _id: order._id,
      orderCode: order._id.toString().slice(-6).toUpperCase(),
      trackingCode: order.trackingCode || "N/A",
      shippingStatus: order.shippingStatus || "Processing",
      totalAmount: order.totalAtPurchase ?? order.totalAmount,
      createdAt: order.createdAt,
      shippingHistory: order.shippingHistory || [],
      invoiceNumber: order.invoiceNumber || "",
      hasInvoicePdf: Boolean(order.invoicePdfPath),
      items: (order.items || []).map((i) => ({
        name: i.productId?.name || i.name || "Product",
        productId: i.productId?._id || i.productId,
        imageUrl:
          i.productId?.imageUrl ||
          i.productId?.image ||
          i.imageUrl ||
          "https://via.placeholder.com/80?text=No+Image",
        price: i.unitPriceAtPurchase ?? i.price,
        quantity: i.quantity,
        size: i.size,
      })),
    }));

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ message: "Order fetch error." });
  }
});

// Invoice info (JSON)
router.get("/:id/invoice", requireAuth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).lean();
    if (!order) return res.status(404).json({ message: "Order not found." });

    const privileged = canAccessAnyOrder(req.user.role);
    if (!privileged && String(order.user) !== String(req.user.id)) {
      return res.status(403).json({ message: "Not authorized to view this invoice." });
    }

    const user = await User.findById(order.user).select("-passwordHash").lean();

    return res.json({
      orderId: order._id,
      invoiceNumber: order.invoiceNumber || "",
      totalAmount: order.totalAtPurchase ?? order.totalAmount,
      createdAt: order.createdAt,
      trackingCode: order.trackingCode || "",
      shippingStatus: order.shippingStatus || "",
      shippingAddress: buildShippingAddress(user, order),
      items: (order.items || []).map((it) => ({
        productId: it.productId,
        name: it.name,
        size: it.size,
        quantity: it.quantity,
        unitPrice: it.unitPriceAtPurchase ?? it.price,
      })),
      hasInvoicePdf: Boolean(order.invoicePdfPath),
    });
  } catch (err) {
    console.error("INVOICE META ERROR:", err);
    return res.status(500).json({ message: "Error fetching invoice." });
  }
});

// Invoice PDF download
router.get("/:id/invoice/pdf", requireAuth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).lean();
    if (!order) return res.status(404).json({ message: "Order not found." });

    const privileged = canAccessAnyOrder(req.user.role);
    if (!privileged && String(order.user) !== String(req.user.id)) {
      return res.status(403).json({ message: "Not authorized to download this invoice." });
    }

    if (!order.invoicePdfPath) {
      return res.status(404).json({ message: "Invoice PDF not found for this order." });
    }

    const invoicesDir = path.resolve(process.cwd(), "invoices");

    const rawPath = order.invoicePdfPath;
    const candidatePath = path.isAbsolute(rawPath) ? rawPath : path.join(process.cwd(), rawPath);
    const resolvedPath = path.resolve(candidatePath);

    if (!resolvedPath.startsWith(invoicesDir)) {
      return res.status(400).json({ message: "Invalid invoice file path." });
    }

    if (!fs.existsSync(resolvedPath)) {
      return res.status(404).json({ message: "Invoice PDF file does not exist on server." });
    }

    const filename = `invoice-${order.invoiceNumber || String(order._id)}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    return res.sendFile(resolvedPath);
  } catch (err) {
    console.error("INVOICE PDF ERROR:", err);
    return res.status(500).json({ message: "Error downloading invoice PDF." });
  }
});

// 3) Sipariş İptali (Kullanıcı Tarafı - Full Order)
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found." });

    if (order.user.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized to cancel this order." });
    }

    if (order.shippingStatus !== "Processing") {
      return res.status(400).json({ message: `Cannot cancel order in ${order.shippingStatus} status.` });
    }

    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { [`sizes.${item.size}`]: item.quantity },
      });
    }

    order.shippingStatus = "Cancelled";
    order.shippingHistory.push({ status: "Order cancelled by customer", date: new Date() });
    order.isCompleted = false;
    await order.save();

    return res.json({ message: "Order cancelled successfully. Stock has been restored." });
  } catch (err) {
    return res.status(500).json({ message: "Error while cancelling order." });
  }
});

// 4) Siparişten Ürün İptali (Support/Admin Tarafı)
router.post("/:orderId/cancel-item", requireRole("supportAgent", "productManager"), async (req, res) => {
  try {
    const { orderId } = req.params;
    const { productId, size } = req.body;

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found." });

    const itemIndex = order.items.findIndex((it) => {
      const itemProdId = it.productId._id ? it.productId._id.toString() : it.productId.toString();
      const targetSize = size === "-" ? "" : (size || "");
      const itemSize = it.size === "-" ? "" : (it.size || "");
      return itemProdId === productId.toString() && itemSize === targetSize;
    });

    if (itemIndex === -1) return res.status(404).json({ message: "Item not found." });

    const cancelledItem = order.items[itemIndex];

    await Product.findByIdAndUpdate(cancelledItem.productId, {
      $inc: { [`sizes.${cancelledItem.size || ""}`]: cancelledItem.quantity }
    });

    const unit = Number(cancelledItem.unitPriceAtPurchase ?? cancelledItem.price) || 0;
    const list = Number(cancelledItem.unitListPriceAtPurchase ?? cancelledItem.price) || 0;
    const qty = Number(cancelledItem.quantity) || 0;

    order.totalAmount = Math.max(0, (order.totalAtPurchase ?? order.totalAmount ?? 0) - unit * qty);
    order.totalAtPurchase = order.totalAmount;

    if (order.subtotalAtPurchase != null) {
      order.subtotalAtPurchase = Math.max(0, Number(order.subtotalAtPurchase) - list * qty);
      order.discountTotalAtPurchase = Math.max(0, Number(order.subtotalAtPurchase) - Number(order.totalAtPurchase));
    }

    order.items.splice(itemIndex, 1);

    order.shippingHistory.push({
      status: `Item cancelled: ${cancelledItem.name}`,
      date: new Date()
    });

    order.shippingStatus = "Cancelled";
    order.isCompleted = false;

    await order.save();
    res.json({ message: "Item successfully cancelled.", order });
  } catch (err) {
    res.status(500).json({ message: "Internal server error." });
  }
});

// 5) Sipariş Durumu Güncelleme (Admin)
router.put("/:id/status", requireRole("productManager"), async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ["Processing", "In-transit", "Delivered", "Cancelled"];

    if (!allowed.includes(status)) return res.status(400).json({ message: "Invalid status." });

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found." });

    order.shippingStatus = status;
    order.shippingHistory.push({ status, date: new Date() });
    order.isCompleted = status === "Delivered";

    await order.save();
    return res.json({ message: "Order status updated.", order });
  } catch (err) {
    return res.status(500).json({ message: "Error while updating status." });
  }
});

// 6) Kargo Takibi
router.get("/track/:trackingCode", async (req, res) => {
  try {
    const order = await Order.findOne({ trackingCode: req.params.trackingCode });
    if (!order) return res.status(404).json({ message: "Tracking code not found." });

    return res.json({
      trackingCode: order.trackingCode,
      shippingStatus: order.shippingStatus,
      shippingHistory: order.shippingHistory,
      items: order.items,
      totalAmount: order.totalAtPurchase ?? order.totalAmount,
      createdAt: order.createdAt,
    });
  } catch (err) {
    return res.status(500).json({ message: "Tracking error." });
  }
});

// 7) Admin Delivery Görünümü
router.get("/admin/deliveries", requireRole("productManager"), async (_req, res) => {
  try {
    const orders = await Order.find({})
      .populate("user", "name email")
      .lean()
      .sort({ createdAt: -1 });

    const deliveryList = orders.flatMap((order) =>
      (order.items || []).map((item) => ({
        deliveryId: order._id,
        customerId: order.user?._id || order.user,       // added
        customerName: order.user?.name || order.user?.email || "Unknown",
        productId: item.productId,                       // added
        productName: item.name,
        quantity: item.quantity,
        totalPrice: (item.unitPriceAtPurchase ?? item.price) * item.quantity,
        deliveryAddress: order.deliveryAddress || "Not specified",
        shippingStatus: order.shippingStatus,
        trackingCode: order.trackingCode,
        createdAt: order.createdAt,
      }))
    );

    return res.json(deliveryList);
  } catch (err) {
    return res.status(500).json({ message: "Error fetching deliveries." });
  }
});

export default router;
