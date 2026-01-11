
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

/**
 * -------------------------
 * Helpers
 * -------------------------
 */
function restoreStockOnProduct(productDoc, size, qty) {
  const rawSize = String(size || "").trim();
  const s = rawSize.toUpperCase(); // "xs" -> "XS"
  const q = Number(qty || 1);

  if (!productDoc || !q || q <= 0) return { ok: false, reason: "invalid" };
  if (!s) return { ok: false, reason: "no-size" };

  // ✅ YOUR SCHEMA: sizes is an OBJECT: { XS: 1, S: 2, ... }
  if (productDoc.sizes && typeof productDoc.sizes === "object" && !Array.isArray(productDoc.sizes)) {
    if (Object.prototype.hasOwnProperty.call(productDoc.sizes, s)) {
      productDoc.sizes[s] = (Number(productDoc.sizes[s]) || 0) + q;
      productDoc.markModified("sizes");
      return { ok: true, mode: "sizes-object", size: s, value: productDoc.sizes[s] };
    }
    return { ok: false, reason: `unknown-size-${s}` };
  }

  // Fallback (just in case): generic numeric stock fields
  const genericFields = ["countInStock", "stock", "quantity", "qty", "inventory", "inStock"];
  for (const f of genericFields) {
    if (typeof productDoc[f] === "number") {
      productDoc[f] += q;
      return { ok: true, mode: "generic-number", field: f, value: productDoc[f] };
    }
  }

  return { ok: false, reason: "no-known-stock-shape" };
}



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

/**
 * Return/Refund helpers
 */

// Product modelinde stok field'ı hangisi bilmiyoruz.
// Buraya sizin field adınızı ekleyebilirsin.
const STOCK_FIELD_CANDIDATES = [
  "stock",
  "countInStock",
  "inventory",
  "inventoryCount",
  "quantity",
  "qty",
  "inStock",
];

function detectStockField(productDoc) {
  if (!productDoc) return null;
  for (const f of STOCK_FIELD_CANDIDATES) {
    if (Object.prototype.hasOwnProperty.call(productDoc, f)) return f;
  }
  return null;
}

async function restoreStockForReturn(returnReq) {
  // returnReq: ReturnRequest doc
  const product = await Product.findById(returnReq.product);
  const stockRes = restoreStockOnProduct(product, returnReq.size, returnReq.quantity);
  await product.save();
  if (!product) {
    return { restored: false, message: "Product not found for stock restore" };
  }

  const field = detectStockField(product);
  if (!field) {
    // stok alanı yoksa kırmayalım, sadece uyarı verelim
    return { restored: false, message: "No stock field detected on Product model" };
  }

  const qty = Number(returnReq.quantity || 1);
  const current = Number(product[field] || 0);

  product[field] = current + qty;
  await product.save();

  return { restored: true, field, before: current, after: product[field] };
}

/**
 * Payment refund placeholder:
 * - Sizin projede Stripe/iyzico/paypal ne varsa burada bağlanacak.
 * - Şimdilik "mock" refund yapıyoruz, DB tarafında status güncelliyoruz.
 */
async function processPaymentRefundMock(order, amount) {
  // amount number
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
 * 1) INVOICES (Existing)
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
 * 2) DISCOUNT CAMPAIGNS (Existing)
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
 * 3) DISCOUNT legacy endpoints (Existing)
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

/**
 * -------------------------
 * 5) PRICES (Manual) (Existing)
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
 * 6) ANALYTICS (Existing)
 * -------------------------
 */
router.get("/analytics", requireSalesManager, async (req, res) => {
  try {
    const { from, to } = req.query || {};
    const dateFilter = buildCreatedAtFilter(from, to);

    const orders = await Order.find(dateFilter)
      .populate("items.productId", "cost price basePrice")
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

    for (const o of orders) {
      const ship = String(o.shippingStatus || "").toLowerCase();
      if (ship === "cancelled") continue;

      const dayKey = new Date(o.createdAt).toISOString().slice(0, 10);

      if (!byDay.has(dayKey)) {
        byDay.set(dayKey, { revenue: 0, cost: 0, refunds: 0 });
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

    for (const [dayKey, amt] of refundByDay.entries()) {
      if (!byDay.has(dayKey)) {
        byDay.set(dayKey, { revenue: 0, cost: 0, refunds: 0 });
      }
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
 * =========================================================
 * SCRUM-95: Revenue & Profit APIs
 * =========================================================
 * Ayrı endpointler:
 * - GET /revenue?from=YYYY-MM-DD&to=YYYY-MM-DD
 * - GET /profit?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Not: "analytics" zaten var, ama JIRA ayrı API istediği için ekledik.
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
    .select("refundedAmount refundedAt processedAt updatedAt createdAt")
    .lean();

  let revenue = 0;
  let cost = 0;
  let refunds = 0;

  for (const r of returns || []) {
    refunds += Number(r.refundedAmount || 0);
  }

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
        unitCost = salePrice * 0.5; // fallback
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
 * =========================================================
 * SCRUM-98: Refund Workflow (Sales manager approval + stock restore + payment refund)
 * =========================================================
 *
 * Endpoints:
 * - GET   /returns?status=Requested|Approved|Rejected|Received|Refunded|Completed|Cancelled
 * - GET   /returns/:id
 * - PATCH /returns/:id/approve   { note?: string, refundNow?: boolean, refundedAmount?: number }
 * - PATCH /returns/:id/reject    { reason?: string, note?: string }
 * - PATCH /returns/:id/receive   { note?: string }
 * - PATCH /returns/:id/refund    { refundedAmount?: number, note?: string }
 * - PATCH /returns/:id/complete  { note?: string }
 *
 * Notlar:
 * - approve default olarak refundNow=true (JIRA’da "approval, stock restore, payment refund" tek akış gibi)
 * - stok restore refund sırasında yapılır (gerçek hayatta iade ürün depoya gelince "receive" sonrası yapmak isteyebilirsin)
 */

router.get("/returns", requireSalesManager, async (req, res) => {
  try {
    const { status, from, to } = req.query || {};
    const dateFilter = buildCreatedAtFilter(from, to);

    const q = { ...dateFilter };
    if (status && typeof status === "string") {
      q.status = status;
    }

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

    // refunded amount:
    // - Eğer göndermezsen order item price*qty'dan hesaplarız.
    let amount = Number(refundedAmount);
    if (!(amount > 0)) {
      const productIdStr = String(rr.product);
      const it = (order.items || []).find((x) => String(x.productId) === productIdStr);
      const unit = Number(it?.unitPriceAtPurchase ?? it?.price ?? 0);
      const qty = Number(rr.quantity || it?.quantity || 1);
      amount = unit * qty;
    }
    amount = round2(amount);

    // 1) STOCK RESTORE
    const stockResult = await restoreStockForReturn(rr);

    // 2) PAYMENT REFUND (mock)
    const refundResult = await processPaymentRefundMock(order, amount);

    // 3) Update ReturnRequest
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

    // 4) Update Order (minimal)
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

    // idempotency
    if (["Refunded", "Completed"].includes(current)) {
      return res.status(200).json({ message: "Already processed", returnRequest: rr });
    }
    if (current === "Rejected") {
      return res.status(400).json({ message: "Cannot approve a rejected request" });
    }
    if (current === "Cancelled") {
      return res.status(400).json({ message: "Cannot approve a cancelled request" });
    }

    rr.status = "Approved";
    rr.approvedAt = new Date();
    rr.processedAt = new Date();

    pushReturnHistory(rr, "Approved", String(note || "Approved"), req.user?.id);
    await rr.save();

    // Default: refundNow = true
    const doRefund = refundNow == null ? true : Boolean(refundNow);

    if (!doRefund) {
      return res.json({ message: "Return approved", returnRequest: rr });
    }

    // Refund now -> reuse /refund logic via function-like flow
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
      String(
        `Approved & Refunded ${amount}. Stock: ${stockResult.restored ? "OK" : "SKIP"}. ${
          note ? `Note: ${note}` : ""
        }`
      ).slice(0, 500),
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
