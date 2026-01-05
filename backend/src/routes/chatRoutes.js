// backend/src/routes/chatRoutes.js
import express from "express";
import multer from "multer";
import path from "path";
import { requireAuth, requireRole } from "../middleware/auth.js";
import Chat from "../models/Chat.js";
import User from "../models/User.js";
import Order from "../models/Order.js";

const router = express.Router();

// ✅ yardımcı: ObjectId mi?
const isObjectId = (v) => /^[0-9a-fA-F]{24}$/.test(String(v));

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
   ADMIN / SUPPORT AGENT ROTalari
   ============================================================ */

router.get("/admin", requireAuth, requireRole("supportAgent"), async (_req, res) => {
  try {
    const chats = await Chat.find({}).sort({ lastMessageAt: -1 }).lean();

    // ✅ SADECE gerçek user objectId’leri user tablosundan çek
    const userIds = chats.map((c) => c.customerId).filter(isObjectId);

    const users = await User.find({ _id: { $in: userIds } })
      .select("_id name email phone address")
      .lean();

    const userMap = {};
    users.forEach((u) => {
      userMap[u._id.toString()] = u;
    });

    const result = chats.map((c) => {
      const guest = !isObjectId(c.customerId);
      const user = !guest ? userMap[c.customerId.toString()] : null;

      return {
        chatId: c.chatId,
        customerId: c.customerId.toString(),
        customerName: guest ? "Guest User" : (user?.name || "Unknown User"),
        customerEmail: guest ? null : user?.email,
        lastMessageAt: c.lastMessageAt,
        status: c.status || "active",
        lastText: c.messages?.length ? c.messages[c.messages.length - 1].text : "",
      };
    });

    res.json(result);
  } catch (err) {
    console.error("Admin chat list error:", err);
    res.status(500).json({ message: "Failed to fetch chats" });
  }
});

router.get(
  "/user-details/:customerId",
  requireAuth,
  requireRole("supportAgent"),
  async (req, res) => {
    try {
      const { customerId } = req.params;

      // ✅ Guest ise burada 404 dönecek (frontend zaten skip edecek)
      const user = await User.findById(customerId).select("-password").lean();
      if (!user) return res.status(404).json({ message: "User not found" });

      const orders = await Order.find({ user: customerId })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();

      res.json({ user, orders: orders || [] });
    } catch (err) {
      console.error("User details error:", err);
      res.status(500).json({ message: "Error fetching user details" });
    }
  }
);

/* ============================================================
   GENEL CHAT ROTalari
   ============================================================ */

router.get("/:chatId", async (req, res) => {
  try {
    const { chatId } = req.params;
    const chat = await Chat.findOne({ chatId }).lean();

    if (!chat) {
      return res.json({ chatId, messages: [] });
    }

    res.json(chat);
  } catch (err) {
    console.error("Fetch messages error:", err);
    res.status(500).json({ message: "Failed to fetch messages" });
  }
});

// ✅ Sohbeti Sonlandırma (Status: closed)
router.put("/:chatId/close", async (req, res) => {
  try {
    const { chatId } = req.params;

    const updatedChat = await Chat.findOneAndUpdate(
      { chatId: chatId },
      {
        $set: {
          status: "closed",
          messages: [], // geçmişi sil
        },
      },
      { new: true }
    );

    if (!updatedChat) return res.status(404).json({ message: "Chat not found" });

    res.status(200).json({ message: "Chat history cleared and closed" });
  } catch (err) {
    console.error("Close chat error:", err);
    res.status(500).json({ message: "Error closing chat" });
  }
});

export default router;
