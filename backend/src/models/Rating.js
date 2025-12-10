// backend/src/models/Rating.js
import mongoose from "mongoose";

const ratingSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // delivered check 
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
    },
    score: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
    },
    comment: {
      type: String,
      default: "",
    },
    // for comment approval
    isCommentApproved: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// one user can rate one time for each product
ratingSchema.index({ productId: 1, userId: 1 }, { unique: true });

export default mongoose.model("Rating", ratingSchema);
