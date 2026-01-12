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
      enum: [
        "Requested",
        "Approved",
        "Rejected",
        "Received",
        "Refunded",
        "Completed",
        "Cancelled",
      ],
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

    // Gerçekte iade edilen tutar (refund işlemi yapılınca set edilir)
    refundedAmount: { type: Number, default: 0 },

    processedAt: { type: Date, default: null },
    rejectReason: { type: String, default: "" },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
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

/**
 * UI'da göstermek için "hesaplanan iade tutarı"
 * - Refund yapıldıysa: refundedAmount
 * - Order items varsa: unitPriceAtPurchase/price * qty
 * - Yoksa: product.price (populate edilmişse) * qty
 */
returnSchema.virtual("refundAmount").get(function () {
  // 0) Refund edilmişse gerçek tutarı göster
  if (this.refundedAmount && Number(this.refundedAmount) > 0) {
    return Number(this.refundedAmount);
  }

  const qty = Number(this.quantity || 1);

  // 1) Öncelik: order içindeki satın alma anındaki fiyat
  const order = this.order;
  if (order && typeof order === "object") {
    const items = order.orderItems || order.items || [];
    if (Array.isArray(items) && items.length) {
      const prodId = String(this.product);
      const size = String(this.size || "").toLowerCase();

      const item = items.find((it) => {
        const itProd = String(it.product?._id || it.product || "");
        const productMatch = itProd === prodId;

        const itSize = String(it.size || "").toLowerCase();
        const sizeMatch = !size || !itSize ? true : itSize === size;

        return productMatch && sizeMatch;
      });

      if (item) {
        const unitPrice = Number(item.unitPriceAtPurchase ?? item.price ?? item.unitPrice ?? 0);
        if (unitPrice > 0) return unitPrice * qty;
      }
    }
  }

  // 2) Fallback: product populate edilmişse product.price * qty
  const product = this.product;
  if (product && typeof product === "object") {
    const unit = Number(
      product.getEffectiveUnitPrice ? product.getEffectiveUnitPrice() : product.price ?? 0
    );
    if (unit > 0) return unit * qty;
  }

  return 0;
});

const ReturnRequest = mongoose.model("ReturnRequest", returnSchema);

export default ReturnRequest;
