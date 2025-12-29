import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },

    // ⭐ REQUIREMENT 9 – ürün bilgileri
    model: { type: String, required: true, default: "" },
    serialNumber: { type: String, required: true, default: "" },
    warrantyStatus: { type: String, required: true, default: "12 months" },
    distributor: { type: String, required: true, default: "" },

    description: { type: String, default: "" },

    // 🔴 SATIŞ FİYATI (müşterinin gördüğü)
    price: { type: Number, required: true, min: 0 },

    category: { type: String, required: true },
    imageUrl: { type: String, default: "" },

    // ✅ SALES MANAGER – discount desteği
    // eski ürünlerde yok olabilir → required DEĞİL
    basePrice: { type: Number, default: null, min: 0 }, // indirimsiz fiyat
    discountRate: { type: Number, default: 0, min: 0, max: 1 },

    // ✅ PRODUCT MANAGER – maliyet (profit hesabı için)
    cost: { type: Number, default: null, min: 0 },

    // stoklar
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

// ✅ ESKİ DATA & YENİ ÜRÜN GÜVENLİĞİ
// basePrice yoksa → price’a eşitle
productSchema.pre("validate", function (next) {
  if (this.basePrice == null && this.price != null) {
    this.basePrice = this.price;
  }

  if (this.discountRate == null) {
    this.discountRate = 0;
  }

  next();
});

export default mongoose.model("Product", productSchema);
