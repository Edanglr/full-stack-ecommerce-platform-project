import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    senderId: {
      type: String,
      required: true,
    },
    senderRole: {
      type: String,
      // ⚠️ DİKKAT: Enum'ı kaldırdım. "admin", "Admin", "support" gelirse hata vermesin diye.
      required: true, 
    },
    senderName: {
      type: String,
      default: "User", // Eğer isim boş gelirse hata vermek yerine "User" yazsın.
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
      required: true,
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