import express from "express";
import Category from "../models/Category.js";
import Product from "../models/Product.js";
import { requireRole } from "../middleware/auth.js";

const router = express.Router();

/**
 * GET /api/categories
 * Returns a union of:
 *  - categories explicitly added (Category collection)
 *  - existing categories used in products (distinct Product.category)
 */
router.get("/", requireRole(["productManager", "salesManager", "supportAgent"]), async (_req, res) => {
  try {
    const [saved, productDistinct] = await Promise.all([
      Category.find({}).select("name slug").lean().sort({ name: 1 }),
      Product.distinct("category"),
    ]);

    const savedNames = (saved || []).map((c) => c.name).filter(Boolean);
    const productNames = (productDistinct || []).filter(Boolean);

    const seen = new Set(savedNames.map((n) => n.toLowerCase().trim()));
    const merged = [...savedNames];

    for (const n of productNames) {
      const key = String(n).toLowerCase().trim();
      if (!key) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(String(n).trim());
    }

    return res.json({ categories: merged });
  } catch (err) {
    console.error("GET /api/categories error:", err);
    return res.status(500).json({ message: "Error fetching categories." });
  }
});

/**
 * POST /api/categories
 * Body: { name }
 * Product manager adds a category.
 */
router.post("/", requireRole("productManager"), async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    if (!name) return res.status(400).json({ message: "Category name is required." });

    const slug = name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");

    const created = await Category.findOneAndUpdate(
      { slug },
      { $setOnInsert: { name, slug } },
      { new: true, upsert: true }
    ).lean();

    return res.status(201).json({ category: { name: created.name, slug: created.slug } });
  } catch (err) {
    console.error("POST /api/categories error:", err);
    return res.status(500).json({ message: "Error creating category." });
  }
});

export default router;
