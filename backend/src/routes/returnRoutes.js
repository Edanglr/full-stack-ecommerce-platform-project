import express from "express";
import ReturnRequest from "../models/returnModel.js"; 
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

router.post("/", requireAuth, async (req, res) => {
  try {
    const { orderId, productId, size, quantity, reason } = req.body;

    console.log("👉 İade İsteği Geldi:", { orderId, productId, reason });

    if (!orderId || !productId || !reason) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    const userId = req.user.id || req.user._id;

    const order = await Order.findById(orderId);
    if (!order) {
      console.log("❌ Sipariş bulunamadı.");
      return res.status(404).json({ message: "Order not found." });
    }

    if (order.user.toString() !== userId.toString()) {
      console.log("❌ Sipariş bu kullanıcıya ait değil.");
      return res.status(403).json({ message: "Not authorized." });
    }

   
    const orderItem = order.items.find((it) => {
        const itemProdId = it.product || it.productId; 
        return (
            itemProdId?.toString() === productId.toString() &&
            (!size || it.size === size)
        );
    });

    if (!orderItem) {
      console.log("❌ Ürün sipariş içinde bulunamadı. Order Items:", order.items);
      return res.status(400).json({
        message: "This product is not part of the order.",
      });
    }

    const finalSize = size || orderItem.size;
    const finalQty = quantity || orderItem.quantity;

    // 3) Zaten iade talebi var mı kontrolü (Mükerrer kaydı önlemek için)
    const existingReturn = await ReturnRequest.findOne({ order: orderId, product: productId });
    if (existingReturn) {
         return res.status(400).json({ message: "Return request already created for this item." });
    }

    const returnRequest = await ReturnRequest.create({
      user: userId,
      order: orderId,
      product: productId,
      size: finalSize,
      quantity: finalQty,
      reason,
      status: "Requested",
    });

    if (!order.shippingHistory) order.shippingHistory = []; // Hata önleyici
    order.shippingHistory.push({
      date: new Date(),
      status: `Return requested: ${reason}`,
    });
   
    await order.save();

    await Product.updateOne(
      { _id: productId },
      { $inc: { [`sizes.${finalSize}`]: finalQty } }
    );

    console.log("✅ İade talebi başarıyla oluşturuldu.");
    return res.status(201).json(returnRequest);

  } catch (err) {
    console.error("🔥 RETURN REQUEST ERROR:", err);
    return res.status(500).json({ message: "Server error: " + err.message });
  }
});


// backend/src/routes/returnRoutes.js içinde GET /my rotasını bul ve güncelle:

router.get("/my", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;

    const returns = await ReturnRequest.find({ user: userId })
      .populate("product", "name imageUrl image price") // Sadece gerekli alanları çekelim
      .populate("order", "_id trackingCode")
      .sort({ createdAt: -1 })
      .lean(); 
      
    const formattedReturns = returns.map((ret) => ({
      ...ret,
      product: {
        ...ret.product,
        imageUrl: ret.product?.imageUrl || ret.product?.image || "https://via.placeholder.com/80?text=No+Image"
      }
    }));

    return res.json(formattedReturns);
  } catch (err) {
    console.error("GET MY RETURNS ERROR:", err);
    return res.status(500).json({ message: "Could not load returns." });
  }
});

export default router;