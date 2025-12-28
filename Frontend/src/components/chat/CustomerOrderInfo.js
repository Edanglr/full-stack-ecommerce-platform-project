// backend/src/routes/orderRoutes.js
import express from "express";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import User from "../models/User.js";

import { generateTrackingCode } from "../utils/trackingCode.js";
import { requireAuth, requireManager } from "../middleware/auth.js";
import { mockBankCharge } from "../utils/mockBank.js";
import { generateInvoicePdf } from "../utils/invoice.js";
import { sendInvoiceEmail } from "../utils/email.js";

const router = express.Router();

/**
 * CREATE ORDER
 * POST /api/orders
 */
router.post("/", requireAuth, async (req, res) => {
  try {
    const { items, deliveryAddress } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "No items provided." });
    }

    // Stock check
    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product) {
        return res.status(404).json({ message: "Product not found." });
      }

      const stock = product.sizes?.[item.size] ?? 0;
      if (stock < item.quantity) {
        return res.status(400).json({
          message: `Not enough stock for ${product.name}`,
        });
      }
    }

    // Decrease stock
    for (const item of items) {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { [`sizes.${item.size}`]: -item.quantity },
      });
    }

    const totalAmount = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    const paymentResult = await mockBankCharge({
      amount: totalAmount,
      user: req.user,
    });

    if (!paymentResult?.success) {
      return res.status(402).json({ message: "Payment failed." });
    }

    const trackingCode = generateTrackingCode();

    const newOrder = await Order.create({
      user: req.user.id,
      items,
      totalAmount,
      trackingCode,
      shippingStatus: "Processing",
      shippingHistory: [{ status: "Order received", date: new Date() }],
      paymentStatus: "Paid",
      deliveryAddress: deliveryAddress || "",
      isCompleted: false,
    });

    const user = await User.findById(req.user.id).lean();

    if (user) {
      try {
        const { invoiceNumber, pdfPath } = await generateInvoicePdf({
          order: newOrder,
          user,
        });

        newOrder.invoiceNumber = invoiceNumber;
        newOrder.invoicePdfPath = pdfPath;
        await newOrder.save();

        if (user.email) {
          await sendInvoiceEmail({ to: user.email, pdfPath });
        }
      } catch (err) {
        console.error("Invoice error:", err);
      }
    }

    return res.status(201).json({
      message: "Order created successfully.",
      orderId: newOrder._id,
      trackingCode,
    });
  } catch (err) {
    console.error("ORDER ERROR:", err);
    res.status(500).json({ message: "Server error." });
  }
});

/**
 * CUSTOMER ORDER HISTORY
 * GET /api/orders/my
 */
router.get("/my", requireAuth, async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user.id })
      .populate({
        path: "items.productId",
        select: "name image price",
      })
      .sort({ createdAt: -1 })
      .lean();

    const formatted = orders.map((order) => ({
      _id: order._id,
      orderCode: order._id.toString().slice(-6).toUpperCase(),
      status: order.shippingStatus,
      totalPrice: order.totalAmount,
      createdAt: order.createdAt,
      items: order.items.map((i) => ({
        name: i.productId?.name,
        image: i.productId?.image,
        price: i.price,
        quantity: i.quantity,
      })),
    }));

    res.json(formatted);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Order fetch error." });
  }
});

/**
 * 🔥 ADMIN / SUPPORT – CUSTOMER ORDERS
 * GET /api/orders/by-user/:userId
 */
router.get("/by-user/:userId", requireManager, async (req, res) => {
  try {
    const orders = await Order.find({ user: req.params.userId })
      .populate({
        path: "items.productId",
        select: "name image price",
      })
      .sort({ createdAt: -1 })
      .lean();

    const formatted = orders.map((order) => ({
      _id: order._id,
      orderCode: order._id.toString().slice(-6).toUpperCase(),
      status: order.shippingStatus,
      totalPrice: order.totalAmount,
      createdAt: order.createdAt,
      items: order.items.map((i) => ({
        name: i.productId?.name,
        image: i.productId?.image,
        price: i.price,
        quantity: i.quantity,
      })),
    }));

    res.json(formatted);
  } catch (err) {
    console.error("BY USER ERROR:", err);
    res.status(500).json({ message: "Cannot fetch customer orders." });
  }
});

/**
 * INVOICE DETAILS
 * GET /api/orders/:id/invoice
 */
router.get("/:id/invoice", requireAuth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).lean();
    if (!order) return res.status(404).json({ message: "Order not found." });

    if (order.user.toString() !== req.user.id) {
      return res.status(403).json({ message: "Forbidden." });
    }

    res.json({
      invoice: {
        invoiceNumber: order.invoiceNumber,
        totalAmount: order.totalAmount,
        createdAt: order.createdAt,
        items: order.items,
        trackingCode: order.trackingCode,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Invoice fetch error." });
  }
});

/**
 * UPDATE SHIPPING STATUS
 * PUT /api/orders/:id/status
 */
router.put("/:id/status", requireManager, async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ["Processing", "In-transit", "Delivered"];

    if (!allowed.includes(status)) {
      return res.status(400).json({ message: "Invalid status." });
    }

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found." });

    order.shippingStatus = status;
    order.shippingHistory.push({ status, date: new Date() });
    order.isCompleted = status === "Delivered";

    await order.save();

    res.json({ message: "Status updated.", order });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Status update error." });
  }
});

/**
 * TRACK ORDER
 * GET /api/orders/track/:trackingCode
 */
router.get("/track/:trackingCode", async (req, res) => {
  try {
    const order = await Order.findOne({ trackingCode: req.params.trackingCode });
    if (!order) {
      return res.status(404).json({ message: "Tracking code not found." });
    }

    res.json({
      trackingCode: order.trackingCode,
      shippingStatus: order.shippingStatus,
      shippingHistory: order.shippingHistory,
      totalAmount: order.totalAmount,
      createdAt: order.createdAt,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Tracking error." });
  }
});

export default router;
