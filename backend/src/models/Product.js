import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },

    model: { type: String, required: true, default: "" },
    serialNumber: { type: String, required: true, default: "" },
    warrantyStatus: { type: String, required: true, default: "12 months" },
    distributor: { type: String, required: true, default: "" },

    description: { type: String, default: "" },

    // Customer-facing price (may reflect discounts).
    price: { type: Number, required: true, min: 0 },

    category: { type: String, required: true },
    imageUrl: { type: String, default: "" },

    // Base price used to compute discounts reliably.
    basePrice: { type: Number, default: null, min: 0 },
    discountRate: { type: Number, default: 0, min: 0, max: 1 }, // 0..1

    // Cost is used for profit calculations.
    cost: { type: Number, default: null, min: 0 },

    sizes: {
      XS: { type: Number, default: 0, min: 0 },
      S: { type: Number, default: 0, min: 0 },
      M: { type: Number, default: 0, min: 0 },
      L: { type: Number, default: 0, min: 0 },
      XL: { type: Number, default: 0, min: 0 },
    },

    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

productSchema.pre("validate", function (next) {
  if (this.basePrice == null && this.price != null) {
    this.basePrice = this.price;
  }
  if (this.discountRate == null) {
    this.discountRate = 0;
  }
  next();
});

// Helper for server-side calculations without changing stored fields.
productSchema.methods.getEffectiveUnitPrice = function () {
  const list = this.basePrice != null ? Number(this.basePrice) : Number(this.price);
  const rate = Number(this.discountRate) || 0;
  return Math.max(0, list * (1 - rate));
};

export default mongoose.model("Product", productSchema);
