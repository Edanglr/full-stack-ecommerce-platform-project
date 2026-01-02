import express from "express";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import Favorite from "../models/Favorite.js";
import User from "../models/User.js";
import DiscountCampaign from "../models/DiscountCampaign.js";
import { requireSalesManager } from "../middleware/auth.js";
import { sendDiscountEmail } from "../utils/email.js";

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

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

async function notifyWishlistUsers(productIds, products, discountRate) {
  const favs = await Favorite.find({ product: { $in: productIds } })
    .select("user product")
    .lean();

  const userIds = [...new Set(favs.map((f) => String(f.user)))];
  const users = await User.find({ _id: { $in: userIds } })
    .select("email name")
    .lean();

  let notifiedCount = 0;

  for (const u of users) {
    if (!u.email) continue;
    try {
      await sendDiscountEmail(u.email, u.name || "Customer", products, discountRate);
      notifiedCount++;
    } catch (emailErr) {
      console.error(`Failed to send discount email to ${u.email}:`, emailErr);
    }
  }

  return notifiedCount;
}

// 1) INVOICES
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

// 2) DISCOUNT CAMPAIGNS
router.post("/discount-campaigns", requireSalesManager, async (req, res) => {
  try {
    const { name, productIds, discountRate, startDate, endDate } = req.body || {};

    if (!name || typeof name !== "string") {
      return res.status(400).json({ message: "name is required" });
    }

    if (!Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ message: "productIds array required" });
    }

    const r = Number(discountRate);
    if (!(r > 0 && r < 1)) {
      return res.status(400).json({ message: "discountRate must be like 0.10, 0.20, 0.25" });
    }

    const s = new Date(startDate);
    const e = new Date(endDate);

    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) {
      return res.status(400).json({ message: "startDate and endDate must be valid dates" });
    }
    if (e < s) {
      return res.status(400).json({ message: "endDate must be after startDate" });
    }

    const products = await Product.find({ _id: { $in: productIds } });
    if (!products || products.length === 0) {
      return res.status(404).json({ message: "No products found" });
    }

    const campaign = await DiscountCampaign.create({
      name: name.trim(),
      discountRate: r,
      affectedProducts: productIds,
      startDate: s,
      endDate: e,
      createdBy: req.user?.id || null,
      isActive: true,
    });

    const now = new Date();
    const shouldApplyNow = now >= s && now <= e;

    let updatedCount = 0;

    if (shouldApplyNow) {
      for (const p of products) {
        const currentPrice = Number(p.price);

        if (p.basePrice == null) p.basePrice = currentPrice;
        if (p.originalPrice == null) p.originalPrice = Number(p.basePrice);

        const base = Number(p.basePrice ?? p.originalPrice ?? p.price);

        p.basePrice = base;
        p.originalPrice = base;
        p.discountRate = r;
        p.price = round2(base * (1 - r));

        await p.save();
        updatedCount++;
      }
    }

    const notifiedUsers = shouldApplyNow
      ? await notifyWishlistUsers(productIds, products, r)
      : 0;

    return res.json({
      message: shouldApplyNow
        ? "Campaign created and applied"
        : "Campaign created (not active yet)",
      campaign,
      updatedCount,
      notifiedUsers,
    });
  } catch (e) {
    console.error("CREATE CAMPAIGN ERROR:", e);
    return res.status(500).json({ message: "Campaign creation failed" });
  }
});

router.get("/discount-campaigns", requireSalesManager, async (_req, res) => {
  try {
    const campaigns = await DiscountCampaign.find({})
      .sort({ createdAt: -1 })
      .populate("affectedProducts", "name price basePrice discountRate");
    return res.json(campaigns);
  } catch (e) {
    console.error("LIST CAMPAIGNS ERROR:", e);
    return res.status(500).json({ message: "Campaign list failed" });
  }
});

router.get("/discount-campaigns/active", async (_req, res) => {
  try {
    const now = new Date();
    const campaigns = await DiscountCampaign.find({
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
    }).populate("affectedProducts", "name price basePrice discountRate");
    return res.json(campaigns);
  } catch (e) {
    console.error("ACTIVE CAMPAIGNS ERROR:", e);
    return res.status(500).json({ message: "Active campaigns fetch failed" });
  }
});

router.patch("/discount-campaigns/:id/deactivate", requireSalesManager, async (req, res) => {
  try {
    const c = await DiscountCampaign.findById(req.params.id);
    if (!c) return res.status(404).json({ message: "Campaign not found" });

    c.isActive = false;
    await c.save();

    return res.json({ message: "Campaign deactivated", campaign: c });
  } catch (e) {
    console.error("DEACTIVATE CAMPAIGN ERROR:", e);
    return res.status(500).json({ message: "Deactivation failed" });
  }
});

// 3) DISCOUNT (Selected Products) legacy endpoint
router.post("/discount", requireSalesManager, async (req, res) => {
  try {
    const { productIds, discountRate } = req.body || {};

    if (!Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ message: "productIds array required" });
    }

    const r = Number(discountRate);
    if (!(r > 0 && r < 1)) {
      return res.status(400).json({ message: "discountRate must be like 0.10, 0.20, 0.25" });
    }

    const products = await Product.find({ _id: { $in: productIds } });
    if (products.length === 0) {
      return res.status(404).json({ message: "No products found" });
    }

    let updatedCount = 0;

    for (const p of products) {
      const currentPrice = Number(p.price);

      if (p.basePrice == null) p.basePrice = currentPrice;
      if (p.originalPrice == null) p.originalPrice = Number(p.basePrice);

      const base = Number(p.basePrice ?? p.originalPrice ?? p.price);

      p.basePrice = base;
      p.originalPrice = base;
      p.discountRate = r;
      p.price = round2(base * (1 - r));

      await p.save();
      updatedCount++;
    }

    const notifiedUsers = await notifyWishlistUsers(productIds, products, r);

    return res.json({
      message: "Discount applied and wishlist users notified",
      updatedCount,
      notifiedUsers,
    });
  } catch (e) {
    console.error("DISCOUNT ERROR:", e);
    return res.status(500).json({ message: "Discount failed" });
  }
});

// 4) DISCOUNT (All Products) legacy endpoint
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

      if (p.basePrice == null) p.basePrice = currentPrice;
      if (p.originalPrice == null) p.originalPrice = Number(p.basePrice);

      const base = Number(p.basePrice ?? p.originalPrice ?? p.price);

      p.basePrice = base;
      p.originalPrice = base;
      p.discountRate = discountRate;
      p.price = round2(base * (1 - discountRate));

      await p.save();
      updatedCount++;
    }

    const productIds = products.map((p) => String(p._id));
    const notifiedUsers = await notifyWishlistUsers(productIds, products, discountRate);

    return res.json({
      message: `Discount applied (%${rate}). Prices updated and emails sent.`,
      updatedCount,
      notifiedUsers,
    });
  } catch (err) {
    console.error("DISCOUNT ALL ERROR:", err);
    return res.status(500).json({ message: "Server error: " + err.message });
  }
});

// 5) PRICES (Manual)
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

      p.price = round2(newPrice);
      p.basePrice = round2(newPrice);
      p.originalPrice = round2(newPrice);
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

// 6) ANALYTICS
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
        const salePrice = Number(it.unitPriceAtPurchase ?? it.price ?? 0);
        const qty = Number(it.quantity ?? 1);

        const lineRevenue = salePrice * qty;

        let unitCost = 0;
        if (it.unitCostAtPurchase != null && !Number.isNaN(Number(it.unitCostAtPurchase))) {
          unitCost = Number(it.unitCostAtPurchase);
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
        revenue: round2(v.revenue),
        cost: round2(v.cost),
        profit: round2(v.revenue - v.cost),
      }));

    return res.json({
      from: from || "1970-01-01",
      to: to || new Date().toISOString().slice(0, 10),
      revenue: round2(revenue),
      cost: round2(cost),
      profit: round2(revenue - cost),
      series,
    });
  } catch (e) {
    console.error("ANALYTICS ERROR:", e);
    return res.status(500).json({ message: "Analytics failed" });
  }
});

export default router;
