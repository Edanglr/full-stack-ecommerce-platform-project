import express from "express";
import Favorite from "../models/Favorite.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

function getUserId(req) {
  // requireAuth farklı projelerde farklı alanlar koyabiliyor
  // testlerde bazen req.user hiç gelmeyebiliyor (extra test)
  return req?.user?.id || req?.user?._id || req?.user?.userId || null;
}

/**
 * GET /api/favorites/my
 * Kullanıcının favorilerini döndürür (product populate'lu)
 */
router.get("/my", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);

    // ✅ FIX: req.user yoksa DB'ye girmeden 401
    if (!userId) {
      return res.status(401).json({ message: "Not authenticated." });
    }

    const favorites = await Favorite.find({ user: userId })
      .populate("product")
      .lean();

    return res.status(200).json(favorites);
  } catch (err) {
    console.error("Error fetching user favorites:", err);
    return res.status(500).json({ message: "Could not load favorites." });
  }
});

/**
 * POST /api/favorites/toggle
 * Body: { productId }
 * Favori varsa kaldırır yoksa ekler
 */
router.post("/toggle", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);

    // ✅ FIX: req.user yoksa 401
    if (!userId) {
      return res.status(401).json({ message: "Not authenticated." });
    }

    const { productId } = req.body || {};

    if (!productId) {
      return res.status(400).json({ message: "Product ID is required." });
    }

    const existing = await Favorite.findOne({ user: userId, product: productId });

    if (existing) {
      await Favorite.deleteOne({ _id: existing._id });
      return res.status(200).json({ favorite: false, message: "Favorite removed." });
    }

    await Favorite.create({ user: userId, product: productId });
    return res.status(201).json({ favorite: true, message: "Favorite added." });
  } catch (err) {
    console.error("Error toggling favorite:", err);
    return res.status(500).json({ message: "Could not toggle favorite." });
  }
});

export default router;
