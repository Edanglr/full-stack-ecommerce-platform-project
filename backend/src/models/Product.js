import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },

    model: { type: String, required: true, default: "" },
    serialNumber: { type: String, required: true, default: "" },
    warrantyStatus: { type: String, required: true, default: "12 months" },
    distributor: { type: String, required: true, default: "" },

    description: { type: String, default: "" },

    price: { type: Number, required: true, min: 0 },

    category: { type: String, required: true },
    imageUrl: { type: String, default: "" },

    // Base price is the non-discounted reference.
    basePrice: { type: Number, default: null, min: 0 },

    // Optional legacy/support field used by some routes.
    originalPrice: { type: Number, default: null, min: 0 },

    // Stored as 0..1.
    discountRate: { type: Number, default: 0, min: 0, max: 1 },

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
  if (this.originalPrice == null && this.basePrice != null) {
    this.originalPrice = this.basePrice;
  }
  if (this.discountRate == null) {
    this.discountRate = 0;
  }
  next();
});

productSchema.methods.getEffectiveUnitPrice = function () {
  const list = this.basePrice != null ? Number(this.basePrice) : Number(this.price);
  const rate = Number(this.discountRate) || 0;
  return Math.max(0, Math.round(list * (1 - rate) * 100) / 100);
};

export default mongoose.model("Product", productSchema);
