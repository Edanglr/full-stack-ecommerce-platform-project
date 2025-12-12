import express from "express";
// DİKKAT: Dosya ismin 'returnModel.js' mi yoksa 'Return.js' mi? 
// Klasördeki ismin neyse onu yazmalısın. Genelde 'Return.js' olur.
import ReturnRequest from "../models/returnModel.js"; 
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// 🔹 POST /api/returns (Sadece '/' yaptık, frontend için daha kolay)
router.post("/", requireAuth, async (req, res) => {
  try {
    const { orderId, productId, size, quantity, reason } = req.body;

    console.log("👉 İade İsteği Geldi:", { orderId, productId, reason });

    if (!orderId || !productId || !reason) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    const userId = req.user.id || req.user._id;

    // 1) Sipariş kullanıcının mı?
    const order = await Order.findById(orderId);
    if (!order) {
      console.log("❌ Sipariş bulunamadı.");
      return res.status(404).json({ message: "Order not found." });
    }

    if (order.user.toString() !== userId.toString()) {
      console.log("❌ Sipariş bu kullanıcıya ait değil.");
      return res.status(403).json({ message: "Not authorized." });
    }

    // 2) Order içinde bu ürün var mı?
    // DÜZELTME: Veritabanında bazen 'product', bazen 'productId' olabilir. İkisini de kontrol edelim.
    const orderItem = order.items.find((it) => {
        const itemProdId = it.product || it.productId; // Olası iki isme de bak
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

    // 4) Return kaydı oluştur
    const returnRequest = await ReturnRequest.create({
      user: userId,
      order: orderId,
      product: productId,
      size: finalSize,
      quantity: finalQty,
      reason,
      status: "Requested",
    });

    // 5) Shipping history update
    if (!order.shippingHistory) order.shippingHistory = []; // Hata önleyici
    order.shippingHistory.push({
      date: new Date(),
      status: `Return requested: ${reason}`,
    });
    
    // Siparişin ana durumunu güncellemek isteyebilirsin
    // order.status = "Return Requested"; 
    await order.save();

    // 6) STOK GÜNCELLEME NOTU:
    // Genellikle iade "Onaylanınca" (Approved) stok artırılır.
    // Talep oluşturulur oluşturulmaz stok artırmak riskli olabilir.
    // Yine de senin mantığın buysa kalabilir:
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
    return res.status(500).json({ message: "Could not load returns." });
  }
});

export default router;