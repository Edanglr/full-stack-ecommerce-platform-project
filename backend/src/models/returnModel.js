import mongoose from "mongoose";

const statusHistorySchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    note: { type: String, default: "" },
    by: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

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
      enum: ["Requested", "Approved", "Rejected", "Received", "Refunded", "Completed", "Cancelled"],
      default: "Requested",
    },

    statusHistory: { type: [statusHistorySchema], default: [] },

    requestedAt: { type: Date, default: Date.now },
    approvedAt: { type: Date, default: null },
    rejectedAt: { type: Date, default: null },
    receivedAt: { type: Date, default: null },
    refundedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },

    refundedAmount: { type: Number, default: 0 },
    processedAt: { type: Date, default: null },
    rejectReason: { type: String, default: "" },
  },
  { timestamps: true }
);

// Initialize status history on first create.
returnSchema.pre("save", function (next) {
  if (this.isNew && (!this.statusHistory || this.statusHistory.length === 0)) {
    this.statusHistory = [
      {
        status: this.status || "Requested",
        note: "Request created",
        by: this.user || null,
        at: this.requestedAt || new Date(),
      },
    ];
  }
  next();
});

const ReturnRequest = mongoose.model("ReturnRequest", returnSchema);

export default ReturnRequest;
