// backend/src/models/Order.js
import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  name: { type: String, required: true },
  size: { type: String, default: "" },
  quantity: { type: Number, required: true },
  price: { type: Number, required: true },
  imageUrl: { type: String, default: "" },
});

// Shipping history schema
const shippingHistorySchema = new mongoose.Schema({
  status: { type: String, required: true },
  date: { type: Date, default: Date.now },
});

const orderSchema = new mongoose.Schema(
  {
    items: {
      type: [orderItemSchema],
      required: true,
    },

    totalAmount: {
      type: Number,
      required: true,
    },

    user: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User" 
    },

    // ⭐ Tracking code added
    trackingCode: { 
      type: String, 
      unique: true 
    },

    // ⭐ Current shipping status
    shippingStatus: {
      type: String,
      default: "Processing", // was "Hazırlanıyor"
    },

    // ⭐ Shipping history timeline
    shippingHistory: {
      type: [shippingHistorySchema],
      default: [],
    },
  },
  { timestamps: true }
);

const Order = mongoose.model("Order", orderSchema);

export default Order;
