// backend/src/routes/chatRoutes.js
import express from "express";
import multer from "multer";
import path from "path";
import mongoose from "mongoose";
import { requireAuth, requireRole } from "../middleware/auth.js";
import Chat from "../models/Chat.js";
import User from "../models/User.js";
import Order from "../models/Order.js";
import Favorite from "../models/Favorite.js";

const router = express.Router();

// 📂 Dosya Kayıt Konfigürasyonu
const storage = multer.diskStorage({
  destination: "uploads/chat/",
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

// 📤 Dosya Yükleme Endpoint'i
router.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).send("No file uploaded.");

  const fileUrl = `http://localhost:5050/uploads/chat/${req.file.filename}`;
  res.json({ fileUrl, fileName: req.file.originalname });
});

/* ============================================================
   ADMIN / SUPPORT AGENT ROTALARI
   ============================================================ */

router.get("/admin", requireAuth, requireRole("supportAgent"), async (req, res) => {
  try {
    console.log("🔍 Admin chat list requested by:", req.user?.name);

    // Tüm chatları çek
    const chats = await Chat.find({})
      .sort({ lastMessageAt: -1 })
      .lean();

    console.log(`📊 Found ${chats.length} total chats in database`);

    if (chats.length === 0) {
      console.log("⚠️ No chats found in database!");
      return res.json([]);
    }

    // ✅ KRİTİK: Guest kullanıcıları filtrele, sadece geçerli ObjectId'leri al
    const validUserIds = chats
      .map(c => c.customerId)
      .filter(id => {
        // ObjectId formatında mı kontrol et
        if (mongoose.Types.ObjectId.isValid(id)) {
          return true;
        } else {
          console.log(`⚠️ Skipping invalid/guest ID: ${id}`);
          return false;
        }
      });

    console.log(`👥 Valid customer IDs: ${validUserIds.length} out of ${chats.length}`);

    // Sadece geçerli ID'ler için User sorgula
    const users = validUserIds.length > 0
      ? await User.find({ _id: { $in: validUserIds } })
        .select("_id name email phone address")
        .lean()
      : [];

    console.log(`👤 Found ${users.length} registered users`);

    const userMap = {};
    users.forEach((u) => {
      userMap[u._id.toString()] = u;
    });

    const result = chats.map((c) => {
      const customerId = c.customerId.toString();
      const user = userMap[customerId];

      // Guest kullanıcı mı kontrol et
      const isGuest = customerId.startsWith('guest-');

      const chatData = {
        chatId: c.chatId,
        customerId: customerId,
        claimedBy: c.claimedBy || null,
        isClaimed: !!c.claimedBy,
        customerName: isGuest
          ? "Guest User"
          : (user?.name || "Unknown User"),
        customerEmail: isGuest
          ? "N/A"
          : (user?.email || "N/A"),
        lastMessageAt: c.lastMessageAt,
        status: c.status || 'active',
        updatedAt: c.updatedAt,
        lastText: c.messages?.length
          ? c.messages[c.messages.length - 1].text
          : "No messages",
        messageCount: c.messages?.length || 0,
        isGuest: isGuest
      };

      return chatData;
    });

    console.log(`✅ Sending ${result.length} chats to frontend (${result.filter(c => c.isGuest).length} guests)`);
    res.json(result);

  } catch (err) {
    console.error("❌❌❌ CRITICAL ERROR in /admin route:");
    console.error("Error name:", err.name);
    console.error("Error message:", err.message);
    console.error("Error stack:", err.stack);

    res.status(500).json({
      message: "Failed to fetch chats",
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

router.get(
  "/user-details/:customerId",
  requireAuth,
  requireRole("supportAgent"),
  async (req, res) => {
    try {
      const { customerId } = req.params;
      console.log("🔍 Fetching user details for:", customerId);

      // Guest kullanıcı kontrolü
      if (customerId.startsWith('guest-')) {
        console.log("👻 Guest user detected, returning placeholder data");
        return res.json({
          user: {
            _id: customerId,
            name: "Guest User",
            email: "N/A",
            phone: "N/A",
            address: "N/A",
            isGuest: true
          },
          orders: []
        });
      }

      // Geçerli ObjectId kontrolü
      if (!mongoose.Types.ObjectId.isValid(customerId)) {
        console.log("❌ Invalid customer ID format:", customerId);
        return res.status(400).json({ message: "Invalid customer ID format" });
      }

      const user = await User.findById(customerId).select("-password").lean();
      if (!user) {
        console.log("❌ User not found:", customerId);
        return res.status(404).json({ message: "User not found" });
      }

      const orders = await Order.find({ user: customerId })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();

      console.log(`✅ User found: ${user.name}, Orders: ${orders.length}`);

      // Favorites (Wishlist) verisini çek
      const favorites = await Favorite.find({ user: customerId })
        .populate("product")
        .lean();

      res.json({
        user,
        orders: orders || [],
        favorites: favorites || [] // Wishlist verisini ekle
      });

    } catch (err) {
      console.error("❌ User details error:", err);
      res.status(500).json({ message: "Error fetching user details", error: err.message });
    }
  }
);

// 🆕 Unclaimed chats (Support Agent)
router.get(
  "/admin/unclaimed",
  requireAuth,
  requireRole("supportAgent"),
  async (req, res) => {
    try {
      const chats = await Chat.find({ claimedBy: null })
        .sort({ lastMessageAt: -1 })
        .lean();

      res.json(chats);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch unclaimed chats" });
    }
  }
);

// 🆕 Claim a conversation
router.post(
  "/admin/claim/:chatId",
  requireAuth,
  requireRole("supportAgent"),
  async (req, res) => {
    try {
      const { chatId } = req.params;
      const agentId = req.user._id;

      const chat = await Chat.findOne({ chatId });

      if (!chat) {
        return res.status(404).json({ message: "Chat not found" });
      }

      if (chat.claimedBy) {
        return res.status(400).json({ message: "Chat already claimed" });
      }

      chat.claimedBy = agentId;
      await chat.save();

      res.json({ message: "Chat claimed successfully" });
    } catch (err) {
      res.status(500).json({ message: "Error claiming chat" });
    }
  }
);

/* ============================================================
   GENEL CHAT ROTALARI
   ============================================================ */

router.get("/:chatId", async (req, res) => {
  try {
    const { chatId } = req.params;
    console.log("🔍 Fetching messages for chatId:", chatId);

    const chat = await Chat.findOne({ chatId }).lean();

    if (!chat) {
      console.log("⚠️ Chat not found, returning empty:", chatId);
      return res.json({ chatId, messages: [], status: 'active' });
    }

    console.log(`✅ Chat found with ${chat.messages?.length || 0} messages, status: ${chat.status}`);

    // Tüm chat objesini döndür (messages dahil)
    res.json({
      chatId: chat.chatId,
      customerId: chat.customerId,
      status: chat.status || 'active',
      messages: chat.messages || [],
      lastMessageAt: chat.lastMessageAt,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt
    });

  } catch (err) {
    console.error("❌ Fetch messages error:", err);
    res.status(500).json({ message: "Failed to fetch messages", error: err.message });
  }
});


router.put("/:chatId/close", async (req, res) => {
  try {
    const { chatId } = req.params;
    console.log("🔒 Closing chat:", chatId);

    const updatedChat = await Chat.findOneAndUpdate(
      { chatId: chatId },
      {
        $set: {
          status: "closed"
        }
      },
      { new: true }
    );

    if (!updatedChat) {
      console.log("❌ Chat not found for closing:", chatId);
      return res.status(404).json({ message: "Chat not found" });
    }

    console.log("✅ Chat closed successfully:", chatId);
    res.status(200).json({
      message: "Chat closed, history preserved.",
      chat: updatedChat
    });

  } catch (err) {
    console.error("❌ Close chat error:", err);
    res.status(500).json({ message: "Error closing chat", error: err.message });
  }
});

// ✅ Sohbet oturumunu TAMAMEN silme (DB'den kaldırır)
router.delete("/:chatId", requireAuth, requireRole("supportAgent", "manager"), async (req, res) => {
  try {
    const { chatId } = req.params;
    
    
    const deletedChat = await Chat.findOneAndDelete({ chatId: chatId });

    if (!deletedChat) {
      return res.status(404).json({ message: "chat not found" });
    }

    res.json({ message: "chat deleted successfully." });
  } catch (err) {
    console.error("Delete chat error:", err);
    res.status(500).json({ message: "Error deleting chat." });
  }
});





export default router;
