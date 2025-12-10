// backend/src/models/returnModel.js
import mongoose from "mongoose"; // 1. Değişiklik: require yerine import

const returnSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    size: {
      type: String,
    },
    quantity: {
      type: Number,
      required: true,
      default: 1,
    },
    reason: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["Requested", "Approved", "Rejected", "Completed"],
      default: "Requested",
    },
  },
  {
    timestamps: true,
  }
);

const ReturnRequest = mongoose.model("ReturnRequest", returnSchema);

export default ReturnRequest; 
