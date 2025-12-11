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

    // login olmuş kullanıcının id'si (auth middleware'den gelen)
    const userId = req.user.id || req.user._id;

    // 1) Sipariş kullanıcının mı?
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    if (order.user.toString() !== userId.toString()) {
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

    const finalSize = size || orderItem.size;
    const finalQty = quantity || orderItem.quantity;

    // 3) Return kaydı oluştur
    const returnRequest = await ReturnRequest.create({
      user: userId,
      order: orderId,
      product: productId,
      size: finalSize,
      quantity: finalQty,
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

    // 5) Ürünün stokunu geri ekle (Mongoose validation'a takılmamak için updateOne)
    await Product.updateOne(
      { _id: productId },
      { $inc: { [`sizes.${finalSize}`]: finalQty } }
    );

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
    const userId = req.user.id || req.user._id;

    const returns = await ReturnRequest.find({ user: userId })
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
