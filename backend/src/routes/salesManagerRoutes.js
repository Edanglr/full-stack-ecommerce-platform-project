import express from "express";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import Favorite from "../models/Favorite.js";
import User from "../models/User.js";
import { requireSalesManager } from "../middleware/auth.js";
import { sendDiscountEmail } from "../utils/email.js";

const router = express.Router();

/**
 * PUT /api/sales/prices
 * body: { updates: [{ productId, newPrice }] }
 * Sales managers can set product prices.
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

      // manuel fiyat set edilince: indirim reset + basePrice güncellenir
      p.price = Math.round(newPrice * 100) / 100;
      p.basePrice = Math.round(newPrice * 100) / 100;
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

/**
 * POST /api/sales/discount
 * body: { productIds: [id...], discountRate: 0.2 }  // %20
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
        .json({ message: "discountRate must be like 0.10, 0.25" });
    }

    const products = await Product.find({ _id: { $in: productIds } });
    if (products.length === 0)
      return res.status(404).json({ message: "No products found" });

    // Price update
    for (const p of products) {
      const base = Number(p.basePrice ?? p.price);
      p.basePrice = base; // store original
      p.discountRate = r;
      p.price = Math.round(base * (1 - r) * 100) / 100;
      await p.save();
    }

    // Wishlist notify: Favorite collection -> userId
    const favs = await Favorite.find({ productId: { $in: productIds } }).select(
      "userId productId"
    );

    const userIds = [...new Set(favs.map((f) => String(f.userId)))];
    const users = await User.find({ _id: { $in: userIds } }).select("email name");

    for (const u of users) {
      if (u.email) {
        await sendDiscountEmail(u.email, u.name || "Customer", products, r);
      }
    }

    return res.json({
      message: "Discount applied and wishlist users notified",
      updatedCount: products.length,
      notifiedUsers: users.length,
    });
  } catch (e) {
    console.error("DISCOUNT ERROR:", e);
    return res.status(500).json({ message: "Discount failed" });
  }
});

/**
 * GET /api/sales/invoices?from=YYYY-MM-DD&to=YYYY-MM-DD
 */
router.get("/invoices", requireSalesManager, async (req, res) => {
  try {
    const { from, to } = req.query;

    const start = from
      ? new Date(`${from}T00:00:00.000Z`)
      : new Date("1970-01-01");
    const end = to ? new Date(`${to}T23:59:59.999Z`) : new Date();

    const orders = await Order.find({ createdAt: { $gte: start, $lte: end } })
      .populate("user", "name email")
      .sort({ createdAt: -1 });

    return res.json(orders);
  } catch (e) {
    console.error("INVOICES ERROR:", e);
    return res.status(500).json({ message: "Invoices fetch failed" });
  }
});

/**
 * GET /api/sales/analytics?from=YYYY-MM-DD&to=YYYY-MM-DD
 * revenue & profit/loss between dates + chart
 * cost default %50 or product cost
 */
router.get("/analytics", requireSalesManager, async (req, res) => {
  try {
    const { from, to } = req.query;

    const start = from
      ? new Date(`${from}T00:00:00.000Z`)
      : new Date("1970-01-01");
    const end = to ? new Date(`${to}T23:59:59.999Z`) : new Date();

    // Order item’da productId var
    const orders = await Order.find({ createdAt: { $gte: start, $lte: end } })
      .populate("items.productId", "cost price basePrice")
      .sort({ createdAt: 1 });

    let revenue = 0;
    let cost = 0;

    const byDay = new Map(); // YYYY-MM-DD -> { revenue, cost }

    for (const o of orders) {
      const dayKey = new Date(o.createdAt).toISOString().slice(0, 10);
      if (!byDay.has(dayKey)) byDay.set(dayKey, { revenue: 0, cost: 0 });

      for (const it of o.items || []) {
        const salePrice = Number(it.price ?? 0); // purchase-time price
        const qty = Number(it.quantity ?? 1);

        const lineRevenue = salePrice * qty;

        const productCost = it.productId?.cost;
        const unitCost =
          productCost != null ? Number(productCost) : salePrice * 0.5;

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
      from: start,
      to: end,
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

