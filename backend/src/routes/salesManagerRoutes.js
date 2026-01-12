// backend/src/routes/salesManagerRoutes.js
import express from "express";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import Favorite from "../models/Favorite.js";
import User from "../models/User.js";
import DiscountCampaign from "../models/DiscountCampaign.js";
import ReturnRequest from "../models/returnModel.js";
import { requireSalesManager } from "../middleware/auth.js";
import { sendDiscountEmail } from "../utils/email.js";

const router = express.Router();

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * -------------------------
 * Date helpers
 * -------------------------
 */
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
 * -------------------------
 * Wishlist notification
 * -------------------------
 */
async function notifyWishlistUsers(productIds, products, discountRate) {
  const favs = await Favorite.find({ product: { $in: productIds } })
    .select("user product")
    .lean();

  const userIds = [...new Set((favs || []).map((f) => String(f.user)))];
  if (userIds.length === 0) return 0;

  const users = await User.find({ _id: { $in: userIds } })
    .select("email name")
    .lean();

  let notifiedCount = 0;
  for (const u of users) {
    if (!u.email) continue;
    try {
      await sendDiscountEmail(u.email, u.name || "Customer", products, discountRate);
      notifiedCount++;
    } catch (e) {
      console.error(`sendDiscountEmail failed for ${u.email}:`, e.message);
    }
  }
  return notifiedCount;
}

/**
 * -------------------------
 * Return helpers (FINAL)
 * Product schema: sizes is OBJECT {XS,S,M,L,XL}
 * -------------------------
 */
async function restoreStockForReturn(returnReq) {
  const product = await Product.findById(returnReq.product);
  if (!product) return { restored: false, message: "Product not found" };

  const size = String(returnReq.size || "").toUpperCase().trim();
  const qty = Number(returnReq.quantity || 1);

  if (!size || !(qty > 0)) {
    return { restored: false, message: "Invalid size/quantity" };
  }

  product.sizes = product.sizes || {};
  const before = Number(product.sizes?.[size] ?? 0);
  product.sizes[size] = before + qty;

  product.markModified("sizes");
  await product.save();

  return { restored: true, size, before, after: product.sizes[size] };
}

async function processPaymentRefundMock(order, amount) {
  const tx = order?.paymentDetails?.transactionId || "";
  return {
    provider: "mock",
    transactionId: tx,
    refundedAmount: round2(amount),
    refundId: `mock_ref_${Date.now()}`,
  };
}

function pushReturnHistory(rr, status, note, byUserId) {
  rr.statusHistory = rr.statusHistory || [];
  rr.statusHistory.push({
    status,
    note: note || "",
    by: byUserId || null,
    at: new Date(),
  });
}

/**
 * -------------------------
 * 1) INVOICES
 * GET /api/sales/invoices?from=YYYY-MM-DD&to=YYYY-MM-DD
 * -------------------------
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

/**
 * -------------------------
 * 2) DISCOUNT CAMPAIGNS
 * -------------------------
 */
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
    if (e < s) return res.status(400).json({ message: "endDate must be after startDate" });

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

    const notifiedUsers = shouldApplyNow ? await notifyWishlistUsers(productIds, products, r) : 0;

    return res.json({
      message: shouldApplyNow ? "Campaign created and applied" : "Campaign created (not active yet)",
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

/**
 * -------------------------
 * 3) DISCOUNT legacy endpoints
 * -------------------------
 */
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
    if (products.length === 0) return res.status(404).json({ message: "No products found" });

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

router.post("/discount/all", requireSalesManager, async (req, res) => {
  try {
    const rate = Number(req.body.rate || 0);
    if (Number.isNaN(rate) || rate < 0 || rate > 90) {
      return res.status(400).json({ message: "Invalid discount rate (0-90)." });
    }

    const products = await Product.find({});
    if (!products || products.length === 0) return res.json({ message: "No products found." });

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
  } catch (e) {
    console.error("DISCOUNT ALL ERROR:", e);
    return res.status(500).json({ message: "Server error: " + e.message });
  }
});

/**
 * -------------------------
 * 4) PRICES (manual)
 * PUT /api/sales/prices
 * body: { updates: [{ productId, newPrice }] }
 * -------------------------
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

/**
 * -------------------------
 * 5) ANALYTICS
 * GET /api/sales/analytics?from&to
 * -------------------------
 */
router.get("/analytics", requireSalesManager, async (req, res) => {
  try {
    const { from, to } = req.query || {};
    const dateFilter = buildCreatedAtFilter(from, to);

    const orders = await Order.find(dateFilter)
      .populate("items.productId", "cost")
      .sort({ createdAt: 1 });

    const { fromDate, toDate } = parseDateRange(from, to);
    const timeCond = {};
    if (fromDate) timeCond.$gte = fromDate;
    if (toDate) timeCond.$lte = toDate;

    const returnTimeFilter =
      Object.keys(timeCond).length > 0
        ? {
            $or: [
              { refundedAt: timeCond },
              { processedAt: timeCond },
              { updatedAt: timeCond },
              { createdAt: timeCond },
            ],
          }
        : {};

    const returns = await ReturnRequest.find({
      status: { $in: ["Refunded", "Completed"] },
      ...returnTimeFilter,
    })
      .select("refundedAmount refundedAt processedAt updatedAt createdAt")
      .lean();

    let revenue = 0;
    let cost = 0;
    let refunds = 0;

    const byDay = new Map();
    const refundByDay = new Map();

    for (const r of returns || []) {
      const eventDate = r.refundedAt || r.processedAt || r.updatedAt || r.createdAt;
      if (!eventDate) continue;

      const dayKey = new Date(eventDate).toISOString().slice(0, 10);
      const amt = Number(r.refundedAmount || 0);

      refunds += amt;
      refundByDay.set(dayKey, (refundByDay.get(dayKey) || 0) + amt);
    }

    for (const o of orders || []) {
      const ship = String(o.shippingStatus || "").toLowerCase();
      if (ship === "cancelled") continue;

      const dayKey = new Date(o.createdAt).toISOString().slice(0, 10);
      if (!byDay.has(dayKey)) byDay.set(dayKey, { revenue: 0, cost: 0, refunds: 0 });

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
          unitCost = salePrice * 0.5; // fallback
        }

        const lineCost = unitCost * qty;

        revenue += lineRevenue;
        cost += lineCost;

        byDay.get(dayKey).revenue += lineRevenue;
        byDay.get(dayKey).cost += lineCost;
      }
    }

    for (const [dayKey, amt] of refundByDay.entries()) {
      if (!byDay.has(dayKey)) byDay.set(dayKey, { revenue: 0, cost: 0, refunds: 0 });
      byDay.get(dayKey).refunds += amt;
    }

    const series = [...byDay.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, v]) => {
        const netRevenue = (Number(v.revenue) || 0) - (Number(v.refunds) || 0);
        return {
          date,
          revenue: round2(netRevenue),
          cost: round2(v.cost),
          refunds: round2(v.refunds),
          profit: round2(netRevenue - (Number(v.cost) || 0)),
        };
      });

    const netRevenueTotal = revenue - refunds;

    return res.json({
      from: from || "1970-01-01",
      to: to || new Date().toISOString().slice(0, 10),
      revenue: round2(netRevenueTotal),
      cost: round2(cost),
      refunds: round2(refunds),
      profit: round2(netRevenueTotal - cost),
      series,
    });
  } catch (e) {
    console.error("ANALYTICS ERROR:", e);
    return res.status(500).json({ message: "Analytics failed" });
  }
});

/**
 * -------------------------
 * 6) REVENUE & PROFIT APIs
 * -------------------------
 */
async function computeRevenueCostRefunds(from, to) {
  const dateFilter = buildCreatedAtFilter(from, to);

  const orders = await Order.find(dateFilter)
    .populate("items.productId", "cost")
    .sort({ createdAt: 1 });

  const { fromDate, toDate } = parseDateRange(from, to);
  const timeCond = {};
  if (fromDate) timeCond.$gte = fromDate;
  if (toDate) timeCond.$lte = toDate;

  const returnTimeFilter =
    Object.keys(timeCond).length > 0
      ? {
          $or: [
            { refundedAt: timeCond },
            { processedAt: timeCond },
            { updatedAt: timeCond },
            { createdAt: timeCond },
          ],
        }
      : {};

  const returns = await ReturnRequest.find({
    status: { $in: ["Refunded", "Completed"] },
    ...returnTimeFilter,
  })
    .select("refundedAmount")
    .lean();

  let revenue = 0;
  let cost = 0;
  let refunds = 0;

  for (const r of returns || []) refunds += Number(r.refundedAmount || 0);

  for (const o of orders || []) {
    const ship = String(o.shippingStatus || "").toLowerCase();
    if (ship === "cancelled") continue;

    for (const it of o.items || []) {
      const salePrice = Number(it.unitPriceAtPurchase ?? it.price ?? 0);
      const qty = Number(it.quantity ?? 1);
      revenue += salePrice * qty;

      let unitCost = 0;
      if (it.unitCostAtPurchase != null && !Number.isNaN(Number(it.unitCostAtPurchase))) {
        unitCost = Number(it.unitCostAtPurchase);
      } else if (it.productId?.cost != null && !Number.isNaN(Number(it.productId.cost))) {
        unitCost = Number(it.productId.cost);
      } else {
        unitCost = salePrice * 0.5;
      }
      cost += unitCost * qty;
    }
  }

  const netRevenue = revenue - refunds;

  return {
    revenue: round2(netRevenue),
    grossRevenue: round2(revenue),
    refunds: round2(refunds),
    cost: round2(cost),
    profit: round2(netRevenue - cost),
  };
}

router.get("/revenue", requireSalesManager, async (req, res) => {
  try {
    const { from, to } = req.query || {};
    const r = await computeRevenueCostRefunds(from, to);
    return res.json({
      from: from || "1970-01-01",
      to: to || new Date().toISOString().slice(0, 10),
      revenue: r.revenue,
      grossRevenue: r.grossRevenue,
      refunds: r.refunds,
    });
  } catch (e) {
    console.error("REVENUE ERROR:", e);
    return res.status(500).json({ message: "Revenue calculation failed" });
  }
});

router.get("/profit", requireSalesManager, async (req, res) => {
  try {
    const { from, to } = req.query || {};
    const r = await computeRevenueCostRefunds(from, to);
    return res.json({
      from: from || "1970-01-01",
      to: to || new Date().toISOString().slice(0, 10),
      profit: r.profit,
      revenue: r.revenue,
      cost: r.cost,
      refunds: r.refunds,
    });
  } catch (e) {
    console.error("PROFIT ERROR:", e);
    return res.status(500).json({ message: "Profit calculation failed" });
  }
});

/**
 * -------------------------
 * 7) RETURNS workflow for Sales Manager
 * -------------------------
 */
router.get("/returns", requireSalesManager, async (req, res) => {
  try {
    const { status, from, to } = req.query || {};
    const dateFilter = buildCreatedAtFilter(from, to);

    const q = { ...dateFilter };
    if (status && typeof status === "string") q.status = status;

    const list = await ReturnRequest.find(q)
      .populate("user", "name email")
      .populate("order", "trackingCode paymentStatus invoiceNumber createdAt")
      .populate("product", "name price")
      .sort({ createdAt: -1 });

    return res.json(list);
  } catch (e) {
    console.error("RETURNS LIST ERROR:", e);
    return res.status(500).json({ message: "Return requests fetch failed" });
  }
});

router.get("/returns/:id", requireSalesManager, async (req, res) => {
  try {
    const rr = await ReturnRequest.findById(req.params.id)
      .populate("user", "name email")
      .populate("order", "trackingCode paymentStatus paymentDetails invoiceNumber createdAt items")
      .populate("product", "name price");

    if (!rr) return res.status(404).json({ message: "Return request not found" });
    return res.json(rr);
  } catch (e) {
    console.error("RETURN DETAIL ERROR:", e);
    return res.status(500).json({ message: "Return request fetch failed" });
  }
});

router.patch("/returns/:id/reject", requireSalesManager, async (req, res) => {
  try {
    const { reason, note } = req.body || {};
    const rr = await ReturnRequest.findById(req.params.id);
    if (!rr) return res.status(404).json({ message: "Return request not found" });

    const current = rr.status;
    if (["Refunded", "Completed", "Cancelled"].includes(current)) {
      return res.status(400).json({ message: `Cannot reject when status is ${current}` });
    }

    rr.status = "Rejected";
    rr.rejectReason = String(reason || rr.rejectReason || note || "").slice(0, 500);
    rr.rejectedAt = new Date();
    rr.processedAt = new Date();

    pushReturnHistory(rr, "Rejected", String(note || reason || "Rejected"), req.user?.id);
    await rr.save();

    return res.json({ message: "Return request rejected", returnRequest: rr });
  } catch (e) {
    console.error("RETURN REJECT ERROR:", e);
    return res.status(500).json({ message: "Reject failed" });
  }
});

router.patch("/returns/:id/receive", requireSalesManager, async (req, res) => {
  try {
    const { note } = req.body || {};
    const rr = await ReturnRequest.findById(req.params.id);
    if (!rr) return res.status(404).json({ message: "Return request not found" });

    const current = rr.status;
    if (["Rejected", "Cancelled"].includes(current)) {
      return res.status(400).json({ message: `Cannot receive when status is ${current}` });
    }
    if (["Refunded", "Completed"].includes(current)) {
      return res.status(200).json({ message: "Already processed", returnRequest: rr });
    }

    rr.status = "Received";
    rr.receivedAt = new Date();
    rr.processedAt = new Date();

    pushReturnHistory(rr, "Received", String(note || "Item received"), req.user?.id);
    await rr.save();

    return res.json({ message: "Marked as received", returnRequest: rr });
  } catch (e) {
    console.error("RETURN RECEIVE ERROR:", e);
    return res.status(500).json({ message: "Receive failed" });
  }
});

router.patch("/returns/:id/refund", requireSalesManager, async (req, res) => {
  try {
    const { refundedAmount, note } = req.body || {};
    const rr = await ReturnRequest.findById(req.params.id);
    if (!rr) return res.status(404).json({ message: "Return request not found" });

    const current = rr.status;
    if (["Rejected", "Cancelled"].includes(current)) {
      return res.status(400).json({ message: `Cannot refund when status is ${current}` });
    }
    if (["Refunded", "Completed"].includes(current)) {
      return res.status(200).json({ message: "Already refunded", returnRequest: rr });
    }

    const order = await Order.findById(rr.order);
    if (!order) return res.status(404).json({ message: "Order not found for this return" });

    let amount = Number(refundedAmount);
    if (!(amount > 0)) {
      const productIdStr = String(rr.product);
      const it = (order.items || []).find((x) => String(x.productId) === productIdStr);
      const unit = Number(it?.unitPriceAtPurchase ?? it?.price ?? 0);
      const qty = Number(rr.quantity || it?.quantity || 1);
      amount = unit * qty;
    }
    amount = round2(amount);

    const stockResult = await restoreStockForReturn(rr);
    const refundResult = await processPaymentRefundMock(order, amount);

    rr.status = "Refunded";
    rr.refundedAmount = amount;
    rr.refundedAt = new Date();
    rr.processedAt = new Date();

    pushReturnHistory(
      rr,
      "Refunded",
      String(note || `Refunded ${amount}. Stock restore: ${stockResult.restored ? "OK" : "SKIP"}`),
      req.user?.id
    );

    await rr.save();

    order.paymentStatus = "Refunded";
    await order.save();

    return res.json({
      message: "Refund completed (mock provider)",
      returnRequest: rr,
      stockRestore: stockResult,
      refund: refundResult,
    });
  } catch (e) {
    console.error("RETURN REFUND ERROR:", e);
    return res.status(500).json({ message: "Refund failed" });
  }
});

router.patch("/returns/:id/complete", requireSalesManager, async (req, res) => {
  try {
    const { note } = req.body || {};
    const rr = await ReturnRequest.findById(req.params.id);
    if (!rr) return res.status(404).json({ message: "Return request not found" });

    if (rr.status !== "Refunded") {
      return res.status(400).json({ message: "Complete requires status=Refunded" });
    }

    rr.status = "Completed";
    rr.completedAt = new Date();
    rr.processedAt = new Date();

    pushReturnHistory(rr, "Completed", String(note || "Completed"), req.user?.id);
    await rr.save();

    return res.json({ message: "Return completed", returnRequest: rr });
  } catch (e) {
    console.error("RETURN COMPLETE ERROR:", e);
    return res.status(500).json({ message: "Complete failed" });
  }
});

router.patch("/returns/:id/approve", requireSalesManager, async (req, res) => {
  try {
    const { note, refundNow, refundedAmount } = req.body || {};

    const rr = await ReturnRequest.findById(req.params.id);
    if (!rr) return res.status(404).json({ message: "Return request not found" });

    const current = rr.status;
    if (["Refunded", "Completed"].includes(current)) {
      return res.status(200).json({ message: "Already processed", returnRequest: rr });
    }
    if (current === "Rejected") return res.status(400).json({ message: "Cannot approve a rejected request" });
    if (current === "Cancelled") return res.status(400).json({ message: "Cannot approve a cancelled request" });

    rr.status = "Approved";
    rr.approvedAt = new Date();
    rr.processedAt = new Date();

    pushReturnHistory(rr, "Approved", String(note || "Approved"), req.user?.id);
    await rr.save();

    const doRefund = refundNow == null ? true : Boolean(refundNow);
    if (!doRefund) return res.json({ message: "Return approved", returnRequest: rr });

    const order = await Order.findById(rr.order);
    if (!order) return res.status(404).json({ message: "Order not found for this return" });

    let amount = Number(refundedAmount);
    if (!(amount > 0)) {
      const productIdStr = String(rr.product);
      const it = (order.items || []).find((x) => String(x.productId) === productIdStr);
      const unit = Number(it?.unitPriceAtPurchase ?? it?.price ?? 0);
      const qty = Number(rr.quantity || it?.quantity || 1);
      amount = unit * qty;
    }
    amount = round2(amount);

    const stockResult = await restoreStockForReturn(rr);
    const refundResult = await processPaymentRefundMock(order, amount);

    rr.status = "Refunded";
    rr.refundedAmount = amount;
    rr.refundedAt = new Date();
    rr.processedAt = new Date();

    pushReturnHistory(
      rr,
      "Refunded",
      String(`Approved & Refunded ${amount}. Stock: ${stockResult.restored ? "OK" : "SKIP"}. ${note ? `Note: ${note}` : ""}`)
        .slice(0, 500),
      req.user?.id
    );

    await rr.save();

    order.paymentStatus = "Refunded";
    await order.save();

    return res.json({
      message: "Return approved + refunded (mock provider)",
      returnRequest: rr,
      stockRestore: stockResult,
      refund: refundResult,
    });
  } catch (e) {
    console.error("RETURN APPROVE ERROR:", e);
    return res.status(500).json({ message: "Approve failed" });
  }
});

export default router;
