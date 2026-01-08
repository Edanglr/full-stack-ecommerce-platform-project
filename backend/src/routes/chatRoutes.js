// backend/src/routes/chatRoutes.js
import express from "express";
import multer from "multer";
import path from "path";
import { requireAuth, requireRole } from "../middleware/auth.js";
import Chat from "../models/Chat.js";
import User from "../models/User.js";
import Order from "../models/Order.js";
import Favorite from "../models/Favorite.js";

const router = express.Router();

const isObjectId = (v) => /^[0-9a-fA-F]{24}$/.test(String(v));

const storage = multer.diskStorage({
  destination: "uploads/chat/",
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

router.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).send("No file uploaded.");

  const fileUrl = `http://localhost:5050/uploads/chat/${req.file.filename}`;
  res.json({ fileUrl, fileName: req.file.originalname });
});

/* SUPPORT AGENT ROUTES */
/*
GET /api/chats/admin
Returns chat list for support agent, including claim info.
Frontend can split into "Unclaimed" and "My Chats".
*/
router.get("/admin", requireAuth, requireRole("supportAgent"), async (_req, res) => {
  try {
    const chats = await Chat.find({}).sort({ lastMessageAt: -1 }).lean();

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

        claimedBy: c.claimedBy || null,
        claimedAt: c.claimedAt || null,
      };
    });

    res.json(result);
  } catch (err) {
    console.error("Admin chat list error:", err);
    res.status(500).json({ message: "Failed to fetch chats" });
  }
});

/*
POST /api/chats/:chatId/claim
Atomic claim to prevent concurrency conflicts.
*/
router.post("/:chatId/claim", requireAuth, requireRole("supportAgent"), async (req, res) => {
  try {
    const { chatId } = req.params;
    const agentId = String(req.user?.id || req.user?._id || "");

    if (!agentId) return res.status(401).json({ message: "Not authenticated." });

    const updated = await Chat.findOneAndUpdate(
      {
        chatId,
        status: "active",
        $or: [{ claimedBy: null }, { claimedBy: "" }],
      },
      {
        $set: {
          claimedBy: agentId,
          claimedAt: new Date(),
        },
      },
      { new: true }
    ).lean();

    if (!updated) {
      const existing = await Chat.findOne({ chatId }).select("claimedBy status").lean();
      if (!existing) return res.status(404).json({ message: "Chat not found." });

      if (existing.status === "closed") {
        return res.status(400).json({ message: "This chat is closed and cannot be claimed." });
      }

      return res.status(409).json({ message: "This chat was already claimed by another support agent." });
    }

    return res.json({ message: "Chat claimed successfully.", chat: updated });
  } catch (err) {
    console.error("Claim chat error:", err);
    return res.status(500).json({ message: "Failed to claim chat." });
  }
});

/*
GET /api/chats/user-details/:customerId
Returns user profile, recent orders (with delivery status), and wishlist items.
If customerId is not a valid ObjectId, it behaves as guest.
*/
router.get("/user-details/:customerId", requireAuth, requireRole("supportAgent"), async (req, res) => {
  try {
    const { customerId } = req.params;

    if (!isObjectId(customerId)) {
      return res.json({
        user: { name: "Guest User" },
        orders: [],
        favorites: [],
      });
    }

    const user = await User.findById(customerId).select("-passwordHash").lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    const orders = await Order.find({ user: customerId })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    const favoritesDocs = await Favorite.find({ user: customerId })
      .populate("product", "name imageUrl image price")
      .lean();

    const favorites = (favoritesDocs || [])
      .map((f) => {
        const p = f.product;
        if (!p) return null;
        return {
          productId: p._id,
          name: p.name,
          price: p.price,
          imageUrl: p.imageUrl || p.image || "https://via.placeholder.com/80?text=No+Image",
        };
      })
      .filter(Boolean);

    res.json({ user, orders: orders || [], favorites });
  } catch (err) {
    console.error("User details error:", err);
    res.status(500).json({ message: "Error fetching user details" });
  }
});

/* GENERAL CHAT ROUTES */

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

router.put("/:chatId/close", async (req, res) => {
  try {
    const { chatId } = req.params;

    const updatedChat = await Chat.findOneAndUpdate(
      { chatId: chatId },
      {
        $set: {
          status: "closed",
          messages: [],
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
