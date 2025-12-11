// backend/src/models/Product.js
import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },

    // ⭐ REQUIREMENT 9 ALANLARI
    model: { type: String, required: true, default: "" },
    serialNumber: { type: String, required: true, default: "" },
    warrantyStatus: { type: String, required: true, default: "12 months" },
    distributor: { type: String, required: true, default: "" },

    description: { type: String, default: "" },
    price: { type: Number, required: true },
    category: { type: String, required: true },

    imageUrl: { type: String, default: "" },

    

    sizes: {
      XS: { type: Number, default: 0 },
      S: { type: Number, default: 0 },
      M: { type: Number, default: 0 },
      L: { type: Number, default: 0 },
      XL: { type: Number, default: 0 },
    },

    averageRating: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model("Product", productSchema);
