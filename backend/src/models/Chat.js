import mongoose from "mongoose";

/**
 * messageSchema: 
 * Sohbet içerisindeki her bir mesajın yapısını belirler.
 */
const messageSchema = new mongoose.Schema(
  {
    senderId: { 
      type: String, 
      required: true 
    },
    senderRole: { 
      type: String, 
      required: true 
    },
    senderName: { 
      type: String, 
      default: "User" 
    },
    text: { 
      type: String, 
      required: true 
    },
    fileUrl: { 
      type: String // 📎 Dosya eki yüklendiğinde URL buraya kaydedilir
    },
    timestamp: { 
      type: Date, 
      default: Date.now 
    },
  },
  { _id: false }
);

/**
 * chatSchema: 
 * Bir müşteri ile destek ekibi arasındaki tüm oturumu temsil eder.
 */
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
    // ✅ Sohbetin aktif olup olmadığını buradan kontrol ediyoruz
    status: {
      type: String,
      enum: ["active", "closed"],
      default: "active",
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