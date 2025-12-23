import express from "express";
import { requireAuth, requireManager } from "../middleware/auth.js";
import Chat from "../models/Chat.js"; 
import User from "../models/User.js";
import Order from "../models/Order.js"; // Sipariş geçmişi için gerekli

const router = express.Router();

/**
 * Admin Panel: Tüm aktif sohbetleri listele
 */
router.get("/admin", requireAuth, requireManager, async (_req, res) => {
  try {
    const chats = await Chat.find({})
      .sort({ lastMessageAt: -1 })
      .lean();

    const userIds = chats.map((c) => c.customerId);

    const users = await User.find({ _id: { $in: userIds } })
      .select("_id name email phone address") 
      .lean();

    const userMap = {};
    users.forEach((u) => {
      userMap[u._id.toString()] = u;
    });

    const result = chats.map((c) => {
      const user = userMap[c.customerId.toString()];
      return {
        chatId: c.chatId,
        customerId: c.customerId.toString(),
        customerName: user?.name || "Unknown User",
        customerEmail: user?.email,
        lastMessageAt: c.lastMessageAt,
        lastText: c.messages?.length
          ? c.messages[c.messages.length - 1].text
          : "",
      };
    });

    res.json(result);
  } catch (err) {
    console.error("Admin chat list error:", err);
    res.status(500).json({ message: "Failed to fetch chats" });
  }
});

// backend/src/routes/chatRouter.js

// Sağ panel detaylarını getiren endpoint
router.get("/user-details/:customerId", requireAuth, requireManager, async (req, res) => {
  try {
    const { customerId } = req.params;

    // Kullanıcı bilgilerini bul
    const user = await User.findById(customerId).select("-password").lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    // Sipariş geçmişini bul
    // ÖNEMLİ: Modelinizdeki kullanıcıyı tutan alan 'user' mı yoksa 'customerId' mi? Kontrol edin.
    const orders = await Order.find({ user: customerId })
      .sort({ createdAt: -1 })
      .limit(10) 
      .lean();

    // Frontend bu objeyi (user ve orders) bekliyor
    res.json({
      user,
      orders: orders || []
    });
  } catch (err) {
    console.error("User details error:", err);
    res.status(500).json({ message: "Error fetching user details" });
  }
});


/**
 * Belirli bir chat'in mesaj geçmişini getir
 */
router.get("/:chatId", requireAuth, async (req, res) => {
  try {
    const { chatId } = req.params;

    const chat = await Chat.findOne({ chatId }).lean();
    if (!chat) {
      return res.json({ chatId, messages: [] });
    }

    res.json({ chatId, messages: chat.messages || [] });
  } catch (err) {
    console.error("Fetch messages error:", err);
    res.status(500).json({ message: "Failed to fetch messages" });
  }
});

export default router;