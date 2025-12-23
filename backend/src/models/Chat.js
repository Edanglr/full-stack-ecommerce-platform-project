import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    senderId: {
      type: String,
      required: true,
    },
    senderRole: {
      type: String,
      enum: ["customer", "support"],
      required: true,
    },
    senderName: {
      type: String,
      required: true, // ⭐ EKLENDİ
    },
    text: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const chatSchema = new mongoose.Schema(
  {
    chatId: {
      type: String,
      unique: true,
      index: true,
      required: true, // chat-<userId>
    },
    customerId: {
      type: String,
      index: true,
      required: true,
    },
    messages: {
      type: [messageSchema],
      default: [],
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Chat", chatSchema);
