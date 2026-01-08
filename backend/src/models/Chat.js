// backend/src/models/Chat.js
import mongoose from "mongoose";

/*
messageSchema: Defines each message structure inside a chat session.
*/
const messageSchema = new mongoose.Schema(
  {
    senderId: {
      type: String,
      required: true,
    },
    senderRole: {
      type: String,
      required: true,
    },
    senderName: {
      type: String,
      default: "User",
    },
    text: {
      type: String,
      required: true,
    },
    fileUrl: {
      type: String,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

/*
chatSchema: Represents a full session between a customer and the support team.
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

    status: {
      type: String,
      enum: ["active", "closed"],
      default: "active",
    },

    /*
    Claiming fields for support agents. If claimedBy is null, chat is unclaimed.
    */
    claimedBy: {
      type: String,
      default: null,
      index: true,
    },
    claimedAt: {
      type: Date,
      default: null,
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
