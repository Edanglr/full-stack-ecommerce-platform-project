// backend/src/models/Product.js
import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    price: { type: Number, required: true },
    category: { type: String, required: true },

    imageUrl: { type: String, default: "" },

    // eski tek stok alanı (kullanmıyorsan sıfır kalabilir)
    stock: { type: Number, default: 0 },

    // beden bazlı stok
    sizes: {
      XS: { type: Number, default: 0 },
      S: { type: Number, default: 0 },
      M: { type: Number, default: 0 },
      L: { type: Number, default: 0 },
      XL: { type: Number, default: 0 },
    },

    // rating özeti
    averageRating: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const Product = mongoose.model("Product", productSchema);
export default Product;
