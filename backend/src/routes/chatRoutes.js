import express from "express";
import { requireAuth, requireManager } from "../middleware/auth.js";
import Chat from "../models/Chat.js"; 
import User from "../models/User.js";


const router = express.Router();

router.get("/admin", requireAuth, requireManager, async (_req, res) => {
  try {
    const chats = await Chat.find({})
      .sort({ lastMessageAt: -1 })
      .lean();

    const userIds = chats.map((c) => c.customerId);

    const users = await User.find({ _id: { $in: userIds } })
      .select("_id name email")
      .lean();

    const userMap = {};
    users.forEach((u) => {
      userMap[u._id.toString()] = u;
    });

    const result = chats.map((c) => {
      // ✅ LOG'LAR BURAYA
      console.log("CHAT customerId:", c.customerId);
      console.log("USER MAP KEYS:", Object.keys(userMap));

      return {
        chatId: c.chatId,
        customerId: c.customerId.toString(),
        customerName:
          userMap[c.customerId.toString()]?.name || "Unknown User",
        lastMessageAt: c.lastMessageAt,
        lastText: c.messages?.length
          ? c.messages[c.messages.length - 1].text
          : "",
      };
    });

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch chats" });
  }
});



/**
 * Customer / Admin: bir chat’in mesajlarını getir
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
    console.error(err);
    res.status(500).json({ message: "Failed to fetch messages" });
  }
});

export default router;
