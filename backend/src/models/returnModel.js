import mongoose from "mongoose";

const returnSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },

    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    size: { type: String, default: "" },

    quantity: { type: Number, default: 1 },

    reason: { type: String, required: true },

    status: {
      type: String,
      enum: ["Requested", "Approved", "Rejected", "Completed"],
      default: "Requested",
    },

    // Refund processing info (sales manager)
    refundedAmount: {
      type: Number,
      default: 0,
    },
    processedAt: {
      type: Date,
    },
    rejectReason: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

const ReturnRequest = mongoose.model("ReturnRequest", returnSchema);

export default ReturnRequest;
