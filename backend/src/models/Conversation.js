const mongoose = require("mongoose");

const ConversationSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  messages: [
    {
      sender: String, // "customer" | "agent"
      text: String,
      createdAt: { type: Date, default: Date.now },
    },
  ],

  // 🔴 SAHİPLENME
  claimedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
});

module.exports = mongoose.model("Conversation", ConversationSchema);
