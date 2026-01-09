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
  filename: (_req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

router.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).send("No file uploaded.");

  const fileUrl = `http://localhost:5050/uploads/chat/${req.file.filename}`;
  return res.json({ fileUrl, fileName: req.file.originalname });
});

/*
Admin/support routes
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

      const lastMsg = c.messages?.length ? c.messages[c.messages.length - 1] : null;

      return {
        chatId: c.chatId,
        customerId: c.customerId.toString(),
        customerName: guest ? "Guest User" : (user?.name || "Unknown User"),
        customerEmail: guest ? null : user?.email,
        lastMessageAt: c.lastMessageAt,
        status: c.status || "active",
        lastText: lastMsg?.text || "",
        claimedBy: c.claimedBy || null,
        claimedAt: c.claimedAt || null,
      };
    });

    return res.json(result);
  } catch (err) {
    console.error("Admin chat list error:", err);
    return res.status(500).json({ message: "Failed to fetch chats" });
  }
});

router.put("/admin/:chatId/claim", requireAuth, requireRole("supportAgent"), async (req, res) => {
  try {
    const { chatId } = req.params;
    const supporterId = req.user?.id || req.user?._id;

    const updated = await Chat.findOneAndUpdate(
      { chatId },
      { $set: { claimedBy: String(supporterId), claimedAt: new Date() } },
      { new: true }
    ).lean();

    if (!updated) return res.status(404).json({ message: "Chat not found" });
    return res.json({ message: "Chat claimed.", chat: updated });
  } catch (err) {
    console.error("Claim chat error:", err);
    return res.status(500).json({ message: "Failed to claim chat" });
  }
});

router.get(
  "/user-details/:customerId",
  requireAuth,
  requireRole("supportAgent"),
  async (req, res) => {
    try {
      const { customerId } = req.params;

      if (!isObjectId(customerId)) {
        return res.json({
          user: { name: "Guest User" },
          orders: [],
          favorites: [],
        });
      }

      const user = await User.findById(customerId).select("-passwordHash -password").lean();
      if (!user) return res.status(404).json({ message: "User not found" });

      const orders = await Order.find({ user: customerId })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();

      const favoritesDoc = await Favorite.findOne({ userId: customerId })
        .populate("items.productId", "name imageUrl image price")
        .lean();

      const favorites = (favoritesDoc?.items || []).map((it) => ({
        productId: it.productId?._id || it.productId,
        name: it.productId?.name || "Product",
        imageUrl: it.productId?.imageUrl || it.productId?.image || "",
        price: it.productId?.price ?? null,
        createdAt: it.createdAt || null,
      }));

      return res.json({ user, orders: orders || [], favorites });
    } catch (err) {
      console.error("User details error:", err);
      return res.status(500).json({ message: "Error fetching user details" });
    }
  }
);

/*
General chat routes
*/

router.get("/:chatId", async (req, res) => {
  try {
    const { chatId } = req.params;
    const chat = await Chat.findOne({ chatId }).lean();

    if (!chat) {
      return res.json({ chatId, status: "active", messages: [] });
    }

    return res.json(chat);
  } catch (err) {
    console.error("Fetch messages error:", err);
    return res.status(500).json({ message: "Failed to fetch messages" });
  }
});

router.put("/:chatId/close", async (req, res) => {
  try {
    const { chatId } = req.params;

    const updatedChat = await Chat.findOneAndUpdate(
      { chatId },
      {
        $set: {
          status: "closed",
          messages: [],
          claimedBy: null,
          claimedAt: null,
        },
      },
      { new: true }
    );

    if (!updatedChat) return res.status(404).json({ message: "Chat not found" });

    return res.status(200).json({ message: "Chat history cleared and closed" });
  } catch (err) {
    console.error("Close chat error:", err);
    return res.status(500).json({ message: "Error closing chat" });
  }
});

export default router;
