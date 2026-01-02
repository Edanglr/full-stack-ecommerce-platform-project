import express from "express";
import Product from "../models/Product.js";
import User from "../models/User.js";
import Favorite from "../models/Favorite.js";
import Order from "../models/Order.js";
import { sendDiscountEmail } from "../utils/email.js";
import { requireSalesManager } from "../middleware/auth.js";

const router = express.Router();

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

/**
 * =========================
 * 1) INVOICES (Date range)
 * GET /api/sales/invoices?from=YYYY-MM-DD&to=YYYY-MM-DD
 * =========================
 */
router.get("/invoices", requireSalesManager, async (req, res) => {
  try {
    const { from, to } = req.query || {};
    const dateFilter = buildCreatedAtFilter(from, to);

    const orders = await Order.find(dateFilter)
      .populate("user", "name email")
      .sort({ createdAt: -1 });

    return res.json(orders);
  } catch (err) {
    console.error("INVOICES ERROR:", err);
    return res.status(500).json({ message: "Server error: " + err.message });
  }
});

/**
 * =========================
 * 2) APPLY DISCOUNT (Selected products)
 * POST /api/sales/discount
 * Body: { productIds: string[], discountRate: number }  // 0.20
 * - Sets discountRate
 * - Stores originalPrice if missing
 * - Updates price = originalPrice * (1 - discountRate)
 * - Sends wishlist emails
 * =========================
 */
router.post("/discount", requireSalesManager, async (req, res) => {
  try {
    const productIds = Array.isArray(req.body.productIds) ? req.body.productIds : [];
    const discountRate = Number(req.body.discountRate);

    if (!productIds.length) {
      return res.status(400).json({ message: "productIds is required." });
    }

    if (Number.isNaN(discountRate) || discountRate <= 0 || discountRate >= 1) {
      return res
        .status(400)
        .json({ message: "discountRate must be a decimal like 0.10, 0.20, 0.25" });
    }

    const products = await Product.find({ _id: { $in: productIds } });
    if (!products || products.length === 0) {
      return res.status(404).json({ message: "No products found for given IDs." });
    }

    // ✅ Update each selected product price based on originalPrice
    // If originalPrice is missing, set it once to current price.
    let updatedCount = 0;

    for (const p of products) {
      const currentPrice = Number(p.price);
      const original = p.originalPrice != null ? Number(p.originalPrice) : currentPrice;

      if (Number.isNaN(original) || original <= 0) continue;

      const newPrice = Math.round(original * (1 - discountRate) * 100) / 100;

      const updateDoc = {
        discountRate: discountRate,
        price: newPrice,
      };

      // set originalPrice only if not exists
      if (p.originalPrice == null) {
        updateDoc.originalPrice = original;
      }

      const r = await Product.updateOne({ _id: p._id }, { $set: updateDoc });
      if (r && (r.modifiedCount || r.nModified)) updatedCount += 1;
    }

    // Wishlist notify: Favorite collection fields are { user, product }
    const favs = await Favorite.find({ product: { $in: productIds } }).select("user product");
    const userIds = [...new Set(favs.map((f) => String(f.user)))];

    const users = await User.find({ _id: { $in: userIds } }).select("name email");

    const productMap = new Map(products.map((pp) => [String(pp._id), pp]));

    let notifiedUsers = 0;
    for (const u of users) {
      const userFavs = favs.filter((f) => String(f.user) === String(u._id));
      const wishlistProducts = userFavs
        .map((f) => productMap.get(String(f.product)))
        .filter(Boolean);

      if (wishlistProducts.length > 0) {
        // ✅ send decimal (0.20), email will convert to %20
        await sendDiscountEmail(u.email, u.name, wishlistProducts, discountRate);
        notifiedUsers += 1;
      }
    }

    return res.json({
      message: "Discount applied to selected products, prices updated, emails sent.",
      updatedCount,
      notifiedUsers,
    });
  } catch (err) {
    console.error("DISCOUNT (SELECTED) ERROR:", err);
    return res.status(500).json({ message: "Server error: " + err.message });
  }
});

/**
 * =========================
 * 3) APPLY DISCOUNT (All products)
 * POST /api/sales/discount/all
 * Body: { rate: number }   // 20 means 20%
 * - Converts to decimal
 * - Stores originalPrice if missing
 * - Updates price = originalPrice * (1 - discountRate)
 * - Sends wishlist emails
 * =========================
 */
router.post("/discount/all", requireSalesManager, async (req, res) => {
  try {
    const rate = Number(req.body.rate || 0);

    if (Number.isNaN(rate) || rate < 0 || rate > 90) {
      return res.status(400).json({ message: "Invalid discount rate." });
    }

    const products = await Product.find({});
    if (!products || products.length === 0) {
      return res.json({ message: "No products found." });
    }

    const discountRate = rate / 100;

    let updatedCount = 0;

    for (const p of products) {
      const currentPrice = Number(p.price);
      const original = p.originalPrice != null ? Number(p.originalPrice) : currentPrice;

      if (Number.isNaN(original) || original <= 0) continue;

      const newPrice = Math.round(original * (1 - discountRate) * 100) / 100;

      const updateDoc = {
        discountRate: discountRate,
        price: newPrice,
      };

      if (p.originalPrice == null) {
        updateDoc.originalPrice = original;
      }

      const r = await Product.updateOne({ _id: p._id }, { $set: updateDoc });
      if (r && (r.modifiedCount || r.nModified)) updatedCount += 1;
    }

    const productIds = products.map((p) => String(p._id));
    const favs = await Favorite.find({ product: { $in: productIds } }).select("user product");

    const userIds = [...new Set(favs.map((f) => String(f.user)))];
    const users = await User.find({ _id: { $in: userIds } }).select("name email");

    const productMap = new Map(products.map((pp) => [String(pp._id), pp]));

    for (const u of users) {
      const userFavs = favs.filter((f) => String(f.user) === String(u._id));
      const wishlistProducts = userFavs
        .map((f) => productMap.get(String(f.product)))
        .filter(Boolean);

      if (wishlistProducts.length > 0) {
        await sendDiscountEmail(u.email, u.name, wishlistProducts, discountRate);
      }
    }

    return res.json({
      message: `Discount applied (%${rate}). Prices updated and emails sent.`,
      updatedCount,
    });
  } catch (err) {
    console.error("DISCOUNT ALL ERROR:", err);
    return res.status(500).json({ message: "Server error: " + err.message });
  }
});

/**
 * =========================
 * 4) PRICES (Manual updates)
 * PUT /api/sales/prices
 * Body: { updates: [{ productId, newPrice }] }
 * =========================
 */
router.put("/prices", requireSalesManager, async (req, res) => {
  try {
    const updates = Array.isArray(req.body.updates) ? req.body.updates : [];

    if (!updates.length) {
      return res.status(400).json({ message: "updates is required." });
    }

    let updatedCount = 0;

    for (const u of updates) {
      const productId = u.productId;
      const newPrice = Number(u.newPrice);

      if (!productId) continue;
      if (Number.isNaN(newPrice) || newPrice <= 0) continue;

      const r = await Product.updateOne(
        { _id: productId },
        { $set: { price: newPrice } }
      );

      if (r && (r.modifiedCount || r.nModified)) {
        updatedCount += 1;
      }
    }

    return res.json({ message: "Prices updated.", updatedCount });
  } catch (err) {
    console.error("PRICES ERROR:", err);
    return res.status(500).json({ message: "Server error: " + err.message });
  }
});

/**
 * =========================
 * 5) ANALYTICS (Revenue / Cost / Profit + daily series)
 * GET /api/sales/analytics?from=YYYY-MM-DD&to=YYYY-MM-DD
 * =========================
 */
router.get("/analytics", requireSalesManager, async (req, res) => {
  try {
    const { from, to } = req.query || {};
    const dateFilter = buildCreatedAtFilter(from, to);

    const orders = await Order.find(dateFilter).sort({ createdAt: 1 });

    let revenue = 0;
    let cost = 0;

    const byDate = new Map();

    for (const o of orders) {
      const total = Number(o.totalAmount || 0);
      revenue += total;

      const created = new Date(o.createdAt);
      const dateStr = !Number.isNaN(created.getTime())
        ? created.toISOString().slice(0, 10)
        : "unknown";

      let orderCost = 0;

      const items = Array.isArray(o.items) ? o.items : [];
      for (const it of items) {
        const qty = Number(it.quantity || 1);

        const explicitCost = Number(it.cost);
        if (!Number.isNaN(explicitCost) && explicitCost > 0) {
          orderCost += explicitCost * qty;
        } else {
          const salePrice = Number(it.price || 0);
          orderCost += salePrice * qty * 0.5;
        }
      }

      cost += orderCost;

      if (!byDate.has(dateStr)) {
        byDate.set(dateStr, { date: dateStr, revenue: 0, cost: 0, profit: 0 });
      }

      const agg = byDate.get(dateStr);
      agg.revenue += total;
      agg.cost += orderCost;
      agg.profit = agg.revenue - agg.cost;
      byDate.set(dateStr, agg);
    }

    const profit = revenue - cost;

    const series = Array.from(byDate.values()).map((x) => ({
      date: x.date,
      revenue: Math.round(x.revenue * 100) / 100,
      cost: Math.round(x.cost * 100) / 100,
      profit: Math.round(x.profit * 100) / 100,
    }));

    return res.json({
      revenue: Math.round(revenue * 100) / 100,
      cost: Math.round(cost * 100) / 100,
      profit: Math.round(profit * 100) / 100,
      series,
    });
  } catch (err) {
    console.error("ANALYTICS ERROR:", err);
    return res.status(500).json({ message: "Server error: " + err.message });
  }
});

export default router;
