// backend/seed/seedProducts.js
// ---------------------------------------------------------
//  HARD LOCKED SEED SCRIPT
//  - Varsayılan: Hiçbir veri değiştirmez.
//  - Yanlışlıkla çalıştırılsa bile PRODUCTS'A DOKUNMAZ.
//  - Sadece FORCE_PRODUCT_SEED="true" ise gerçekten seed yapar.
// ---------------------------------------------------------

import mongoose from "mongoose";
import dotenv from "dotenv";
import Product from "../src/models/Product.js";

dotenv.config();

// 🔒 Varsayılan: Kilitli
if (process.env.FORCE_PRODUCT_SEED !== "true") {
  console.log("⚠️  seedProducts.js KİLİTLİ DURUMDA ÇALIŞTI.");
  console.log("⚠️  Mevcut ürünler, rating’ler, order’lar KESİNLİKLE DEĞİŞTİRİLMEDİ.");
  console.log(
    "⚠️  Eğer gerçekten seed çalıştırmak istiyorsan, komutu ŞU ŞEKİLDE ve BİLİNÇLİ OLARAK kullanmalısın:"
  );
  console.log("");
  console.log('   FORCE_PRODUCT_SEED=true node seed/seedProducts.js');
  console.log("");
  console.log(
    "⚠️  Normal proje kullanımında ASLA bu env değişkenini set etme."
  );
  process.exit(0);
}

// ---------------------------------------------------------
//  AŞAĞISI SADECE BİLİNÇLİ OLARAK FORCE_PRODUCT_SEED=true
//  İLE ÇALIŞTIRILAN DURUMDA DEVREYE GİRER.
//  (Upsert + deleteMany YOK, id’ler bozulmaz.)
// ---------------------------------------------------------

// NOT: Başlangıç stokları sabit, her ürün için beden bazlı
const products = [
  // SWEATSHIRT
  {
    name: "Basic Sweatshirt",
    price: 299.99,
    description: "Classic warm sweatshirt",
    imageUrl: "/images/product/classicSweat.jpeg",
    category: "sweatshirt",
    sizes: { XS: 2, S: 5, M: 6, L: 4, XL: 3 },
  },
  {
    name: "Hoodie",
    price: 349.99,
    description: "Comfortable beige hoodie",
    imageUrl: "/images/product/ciga-cat-hoodie-bej.jpeg",
    category: "sweatshirt",
    sizes: { XS: 1, S: 4, M: 5, L: 4, XL: 2 },
  },
  {
    name: "Printed Sweatshirt",
    price: 329.99,
    description: "Blue printed hoodie",
    imageUrl: "/images/product/discover-arka-hoodie-mavi.jpeg",
    category: "sweatshirt",
    sizes: { XS: 1, S: 3, M: 5, L: 3, XL: 2 },
  },
  {
    name: "Zippered Sweatshirt",
    price: 379.99,
    description: "Orange zip hoodie",
    imageUrl: "/images/product/hoodieturuncu.jpeg",
    category: "sweatshirt",
    sizes: { XS: 0, S: 3, M: 4, L: 4, XL: 2 },
  },
  {
    name: "Vintage Sweatshirt",
    price: 359.99,
    description: "Vintage white sweatshirt",
    imageUrl: "/images/product/29_front_white_On-beyaz_mockup.jpg",
    category: "sweatshirt",
    sizes: { XS: 2, S: 4, M: 5, L: 3, XL: 1 },
  },
  {
    name: "Oversized Sweatshirt",
    price: 399.99,
    description: "Oversized sweatshirt",
    imageUrl: "/images/product/oversized-sweatshirt.jpg", // Basic ile aynı olmasın diye farklı yol
    category: "sweatshirt",
    sizes: { XS: 1, S: 3, M: 4, L: 4, XL: 3 },
  },

  // T-SHIRT
  {
    name: "Basic T-shirt",
    price: 149.99,
    description: "Basic cotton t-shirt",
    imageUrl: "/images/product/basic-tee.jpg",
    category: "t-shirt",
    sizes: { XS: 3, S: 6, M: 7, L: 5, XL: 3 },
  },
  {
    name: "Striped T-shirt",
    price: 179.99,
    description: "Striped casual t-shirt",
    imageUrl: "/images/product/striped-tee.jpg",
    category: "t-shirt",
    sizes: { XS: 2, S: 5, M: 6, L: 4, XL: 2 },
  },
  {
    name: "Coctail Printed T-shirt",
    price: 159.99,
    description: "V-neck basic t-shirt",
    imageUrl: "/images/product/coctailtshirt.jpg",
    category: "t-shirt",
    sizes: { XS: 2, S: 4, M: 5, L: 4, XL: 2 },
  },

  // SHORT
  {
    name: "Denim Shorts",
    price: 249.99,
    description: "Classic denim shorts",
    imageUrl: "/images/product/denim-shorts.jpg",
    category: "short",
    sizes: { XS: 0, S: 3, M: 5, L: 4, XL: 2 },
  },
  {
    name: "Sport Shorts",
    price: 199.99,
    description: "Comfortable sport shorts",
    imageUrl: "/images/product/sport-shorts.jpg",
    category: "short",
    sizes: { XS: 0, S: 4, M: 5, L: 3, XL: 1 },
  },

  // JEANS
  {
    name: "Fringe Loose Fit Jeans",
    price: 499.99,
    description: "Loose fit jeans with fringe",
    imageUrl: "/images/product/fringejeans.jpg",
    category: "jeans",
    sizes: { XS: 0, S: 2, M: 4, L: 4, XL: 2 },
  },
  {
    name: "Black Loose Fit Jeans",
    price: 549.99,
    description: "BLACK LOOSE FIT JEANS",
    imageUrl: "/images/product/blackjeans.jpg",
    category: "jeans",
    sizes: { XS: 0, S: 3, M: 5, L: 4, XL: 2 },
  },

  // KNITWEAR
  {
    name: "Crewneck Sweater",
    price: 399.99,
    description: "Basic knit crewneck sweater",
    imageUrl: "/images/product/crewneck-sweater.jpg",
    category: "knitwear",
    sizes: { XS: 1, S: 3, M: 4, L: 3, XL: 1 },
  },
  {
    name: "Cardigan",
    price: 449.99,
    description: "Buttoned knit cardigan",
    imageUrl: "/images/product/cardigan.jpg",
    category: "knitwear",
    sizes: { XS: 1, S: 3, M: 4, L: 3, XL: 1 },
  },
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // ÖNEMLİ:
    //  - Product.deleteMany() YOK
    //  - İSİME GÖRE UPSERT YAPIYORUZ → id aynı kalır, rating/order bağlantısı BOZULMAZ
    for (const p of products) {
      const doc = await Product.findOneAndUpdate(
        { name: p.name }, // aynı isim = aynı ürün
        {
          $set: {
            description: p.description,
            price: p.price,
            category: p.category,
            imageUrl: p.imageUrl,
            sizes: p.sizes,
          },
          $setOnInsert: {
            stock: 0,
            averageRating: 0,
            ratingCount: 0,
          },
        },
        { upsert: true, new: true }
      );

      console.log(`➡️ ${doc.name} hazır (id: ${doc._id})`);
    }

    console.log(
      "✅ Seeding (FORCE_PRODUCT_SEED=true ile) tamamlandı. Mevcut rating/order bağlantıları korunmuş olmalı."
    );
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("❌ SEED ERROR:", err);
    process.exit(1);
  }
}

seed();
