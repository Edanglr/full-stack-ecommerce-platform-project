// backend/src/routes/salesManagerRoutes.js
import express from "express";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import Favorite from "../models/Favorite.js";
import User from "../models/User.js";
import { requireSalesManager } from "../middleware/auth.js";
import { sendDiscountEmail } from "../utils/email.js";

const router = express.Router();

// ========== HELPER FUNCTIONS ==========

function parseDateRange(from, to) {
  let fromDate = null;
  let toDate = null;

  if (from) {
    const d = new Date(from);
    if (!Number.isNaN(d.getTime())) {
      fromDate = d;
      fromDate.setHours(0, 0, 0, 0);
    }
  }

  if (to) {
    const d = new Date(to);
    if (!Number.isNaN(d.getTime())) {
      toDate = d;
      toDate.setHours(23, 59, 59, 999);
    }
  }

  return { fromDate, toDate };
}

function buildCreatedAtFilter(from, to) {
  const { fromDate, toDate } = parseDateRange(from, to);
  const filter = {};
  if (fromDate) filter.$gte = fromDate;
  if (toDate) filter.$lte = toDate;
  return Object.keys(filter).length ? { createdAt: filter } : {};
}

// ========== 1) INVOICES ==========
/**
 * GET /api/sales/invoices?from=YYYY-MM-DD&to=YYYY-MM-DD
 */
router.get("/invoices", requireSalesManager, async (req, res) => {
  try {
    const { from, to } = req.query || {};
    const dateFilter = buildCreatedAtFilter(from, to);

    const orders = await Order.find(dateFilter)
      .populate("user", "name email")
      .sort({ createdAt: -1 });

    return res.json(orders);
  } catch (e) {
    console.error("INVOICES ERROR:", e);
    return res.status(500).json({ message: "Invoices fetch failed" });
  }
});

// ========== 2) DISCOUNT (Selected Products) ==========
/**
 * POST /api/sales/discount
 * Body: { productIds: [id...], discountRate: 0.2 }  // 0.20 = %20
 * ✅ TASK 2: Wishlist notification
 */
router.post("/discount", requireSalesManager, async (req, res) => {
  try {
    const { productIds, discountRate } = req.body || {};
    
    if (!Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ message: "productIds array required" });
    }

    const r = Number(discountRate);
    if (!(r > 0 && r < 1)) {
      return res
        .status(400)
        .json({ message: "discountRate must be like 0.10, 0.20, 0.25" });
    }

    const products = await Product.find({ _id: { $in: productIds } });
    if (products.length === 0) {
      return res.status(404).json({ message: "No products found" });
    }

    // ✅ Price update - basePrice yerine originalPrice kullan (consistency)
    let updatedCount = 0;

    for (const p of products) {
      const currentPrice = Number(p.price);
      
      // originalPrice yoksa mevcut fiyatı kaydet
      if (p.basePrice == null && p.originalPrice == null) {
        p.basePrice = currentPrice;
        p.originalPrice = currentPrice;
      }
      
      const base = Number(p.basePrice ?? p.originalPrice ?? p.price);
      
      p.basePrice = base;
      p.originalPrice = base;
      p.discountRate = r;
      p.price = Math.round(base * (1 - r) * 100) / 100;
      
      await p.save();
      updatedCount++;
    }

    // ✅ TASK 2: Wishlist notify
    const favs = await Favorite.find({ product: { $in: productIds } })
      .select("user product")
      .lean();

    const userIds = [...new Set(favs.map((f) => String(f.user)))];
    const users = await User.find({ _id: { $in: userIds } })
      .select("email name")
      .lean();

    let notifiedCount = 0;

    for (const u of users) {
      if (u.email) {
        try {
          await sendDiscountEmail(u.email, u.name || "Customer", products, r);
          notifiedCount++;
        } catch (emailErr) {
          console.error(`Failed to send discount email to ${u.email}:`, emailErr);
        }
      }
    }

    return res.json({
      message: "Discount applied and wishlist users notified",
      updatedCount: updatedCount,
      notifiedUsers: notifiedCount,
    });
  } catch (e) {
    console.error("DISCOUNT ERROR:", e);
    return res.status(500).json({ message: "Discount failed" });
  }
});

// ========== 3) DISCOUNT (All Products) ==========
/**
 * POST /api/sales/discount/all
 * Body: { rate: 20 }  // 20 = %20
 */
router.post("/discount/all", requireSalesManager, async (req, res) => {
  try {
    const rate = Number(req.body.rate || 0);

    if (Number.isNaN(rate) || rate < 0 || rate > 90) {
      return res.status(400).json({ message: "Invalid discount rate (0-90)." });
    }

    const products = await Product.find({});
    if (!products || products.length === 0) {
      return res.json({ message: "No products found." });
    }

    const discountRate = rate / 100;
    let updatedCount = 0;

    for (const p of products) {
      const currentPrice = Number(p.price);
      
      if (p.basePrice == null && p.originalPrice == null) {
        p.basePrice = currentPrice;
        p.originalPrice = currentPrice;
      }
      
      const base = Number(p.basePrice ?? p.originalPrice ?? p.price);

      p.basePrice = base;
      p.originalPrice = base;
      p.discountRate = discountRate;
      p.price = Math.round(base * (1 - discountRate) * 100) / 100;

      await p.save();
      updatedCount++;
    }

    // Wishlist notify for all products
    const productIds = products.map((p) => String(p._id));
    const favs = await Favorite.find({ product: { $in: productIds } })
      .select("user product")
      .lean();

    const userIds = [...new Set(favs.map((f) => String(f.user)))];
    const users = await User.find({ _id: { $in: userIds } })
      .select("name email")
      .lean();

    const productMap = new Map(products.map((pp) => [String(pp._id), pp]));
    let notifiedCount = 0;

    for (const u of users) {
      if (!u.email) continue;

      const userFavs = favs.filter((f) => String(f.user) === String(u._id));
      const wishlistProducts = userFavs
        .map((f) => productMap.get(String(f.product)))
        .filter(Boolean);

      if (wishlistProducts.length > 0) {
        try {
          await sendDiscountEmail(u.email, u.name || "Customer", wishlistProducts, discountRate);
          notifiedCount++;
        } catch (emailErr) {
          console.error(`Failed to send email to ${u.email}:`, emailErr);
        }
      }
    }

    return res.json({
      message: `Discount applied (%${rate}). Prices updated and emails sent.`,
      updatedCount,
      notifiedUsers: notifiedCount,
    });
  } catch (err) {
    console.error("DISCOUNT ALL ERROR:", err);
    return res.status(500).json({ message: "Server error: " + err.message });
  }
});

// ========== 4) PRICES (Manual) ==========
/**
 * PUT /api/sales/prices
 * Body: { updates: [{ productId, newPrice }] }
 */
router.put("/prices", requireSalesManager, async (req, res) => {
  try {
    const { updates } = req.body || {};
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ message: "updates array required" });
    }

    let updatedCount = 0;

    for (const u of updates) {
      const productId = u?.productId;
      const newPrice = Number(u?.newPrice);

      if (!productId || !(newPrice > 0)) continue;

      const p = await Product.findById(productId);
      if (!p) continue;

      // Manuel fiyat değişikliği - indirimi sıfırla
      p.price = Math.round(newPrice * 100) / 100;
      p.basePrice = Math.round(newPrice * 100) / 100;
      p.originalPrice = Math.round(newPrice * 100) / 100;
      p.discountRate = 0;

      await p.save();
      updatedCount++;
    }

    return res.json({ message: "Prices updated", updatedCount });
  } catch (e) {
    console.error("PRICES ERROR:", e);
    return res.status(500).json({ message: "Price update failed" });
  }
});

// ========== 5) ANALYTICS ==========
/**
 * GET /api/sales/analytics?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Revenue, cost, profit + daily series
 */
router.get("/analytics", requireSalesManager, async (req, res) => {
  try {
    const { from, to } = req.query || {};
    const dateFilter = buildCreatedAtFilter(from, to);

    const orders = await Order.find(dateFilter)
      .populate("items.productId", "cost price basePrice")
      .sort({ createdAt: 1 });

    let revenue = 0;
    let cost = 0;

    const byDay = new Map();

    for (const o of orders) {
      const dayKey = new Date(o.createdAt).toISOString().slice(0, 10);
      
      if (!byDay.has(dayKey)) {
        byDay.set(dayKey, { revenue: 0, cost: 0 });
      }

      for (const it of o.items || []) {
        const salePrice = Number(it.price ?? 0);
        const qty = Number(it.quantity ?? 1);

        const lineRevenue = salePrice * qty;

        // Cost: item.cost > productId.cost > 50% of sale price
        let unitCost = 0;
        if (it.cost != null && !Number.isNaN(Number(it.cost))) {
          unitCost = Number(it.cost);
        } else if (it.productId?.cost != null && !Number.isNaN(Number(it.productId.cost))) {
          unitCost = Number(it.productId.cost);
        } else {
          unitCost = salePrice * 0.5;
        }

        const lineCost = unitCost * qty;

        revenue += lineRevenue;
        cost += lineCost;

        byDay.get(dayKey).revenue += lineRevenue;
        byDay.get(dayKey).cost += lineCost;
      }
    }

    const series = [...byDay.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, v]) => ({
        date,
        revenue: Math.round(v.revenue * 100) / 100,
        cost: Math.round(v.cost * 100) / 100,
        profit: Math.round((v.revenue - v.cost) * 100) / 100,
      }));

    return res.json({
      from: from || "1970-01-01",
      to: to || new Date().toISOString().slice(0, 10),
      revenue: Math.round(revenue * 100) / 100,
      cost: Math.round(cost * 100) / 100,
      profit: Math.round((revenue - cost) * 100) / 100,
      series,
    });
  } catch (e) {
    console.error("ANALYTICS ERROR:", e);
    return res.status(500).json({ message: "Analytics failed" });
  }
});

export default router;
