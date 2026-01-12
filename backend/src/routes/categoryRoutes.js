// backend/src/routes/categoryRoutes.js
import express from "express";
import Category from "../models/Category.js";
import Product from "../models/Product.js";
import { requireRole } from "../middleware/auth.js";

const router = express.Router();

function toSlug(name = "") {
  return String(name)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

function toDisplayName(slug = "") {
  const s = String(slug || "").trim();
  if (!s) return "";
  // "t-shirt" -> "T-shirt", "knitwear" -> "Knitwear"
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * GET /api/categories
 * PUBLIC: navbar da görebilsin
 *
 * Returns:
 *  - items: [{ name, slug }]
 *  - categories: [slug, slug, ...]  // geriye uyumluluk (AdminProductManagerPage bozulmasın)
 */
router.get("/", async (_req, res) => {
  try {
    const [saved, productDistinct] = await Promise.all([
      Category.find({}).select("name slug").lean().sort({ name: 1 }),
      Product.distinct("category"),
    ]);

    const savedItems = (saved || [])
      .map((c) => ({
        name: String(c?.name || "").trim(),
        slug: String(c?.slug || "").trim(),
      }))
      .filter((x) => x.name && x.slug);

    const productCats = (productDistinct || [])
      .map((x) => String(x || "").trim())
      .filter(Boolean);

    // Merge by slug (case-insensitive)
    const seen = new Set(savedItems.map((i) => i.slug.toLowerCase()));
    const mergedItems = [...savedItems];

    for (const cat of productCats) {
      const slug = toSlug(cat);
      if (!slug) continue;

      const key = slug.toLowerCase();
      if (seen.has(key)) continue;

      seen.add(key);
      mergedItems.push({
        name: toDisplayName(slug),
        slug,
      });
    }

    // categories: just slugs (for old frontend code)
    const categories = mergedItems.map((i) => i.slug);

    return res.json({ items: mergedItems, categories });
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

    const slug = toSlug(name);
    if (!slug) return res.status(400).json({ message: "Invalid category name." });

    const created = await Category.findOneAndUpdate(
      { slug },
      { $setOnInsert: { name, slug } },
      { new: true, upsert: true }
    ).lean();

    return res.status(201).json({
      category: { name: created.name, slug: created.slug },
    });
  } catch (err) {
    console.error("POST /api/categories error:", err);
    return res.status(500).json({ message: "Error creating category." });
  }
});

export default router;
