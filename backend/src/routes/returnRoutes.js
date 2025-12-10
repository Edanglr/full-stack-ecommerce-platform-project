// backend/src/routes/returnRoutes.js
import express from "express";
import ReturnRequest from "../models/returnModel.js";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// 🔹 POST /api/returns/request  -> return talebi oluştur
router.post("/request", requireAuth, async (req, res) => {
  try {
    const { orderId, productId, size, quantity, reason } = req.body;

    if (!orderId || !productId || !reason) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    // 1) Sipariş kullanıcının mı?
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    if (order.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized." });
    }

    // 2) Order içinde bu ürün var mı?
    const orderItem = order.items.find(
      (it) =>
        it.productId?.toString() === productId.toString() &&
        (!size || it.size === size)
    );

    if (!orderItem) {
      return res.status(400).json({
        message: "This product is not part of the order.",
      });
    }

    // 3) Return kaydı oluştur
    const returnRequest = await ReturnRequest.create({
      user: req.user._id,
      order: orderId,
      product: productId,
      size: size || orderItem.size,
      quantity: quantity || orderItem.quantity,
      reason,
      status: "Requested",
    });

    // 4) Shipping history update
    order.shippingHistory.push({
      date: new Date(),
      status: `Return requested: ${reason}`,
    });
    order.shippingStatus = "Return requested";
    await order.save();

    // 5) Ürünün stokunu geri ekle
    const product = await Product.findById(productId);
    if (product) {
      const qty = quantity || orderItem.quantity;
      const sizeKey = orderItem.size;

      if (product.sizes && product.sizes[sizeKey] !== undefined) {
        product.sizes[sizeKey] += qty;
      }

      await product.save();
    }

    return res.status(201).json(returnRequest);
  } catch (err) {
    console.error("RETURN REQUEST ERROR:", err);
    return res
      .status(500)
      .json({ message: "Unexpected error while creating return." });
  }
});

// 🔹 GET /api/returns/my
router.get("/my", requireAuth, async (req, res) => {
  try {
    const returns = await ReturnRequest.find({ user: req.user._id })
      .populate("product")
      .populate("order")
      .sort({ createdAt: -1 });

    return res.json(returns);
  } catch (err) {
    console.error("GET MY RETURNS ERROR:", err);
    return res
      .status(500)
      .json({ message: "Unexpected error while loading returns." });
  }
});

export default router;
