import express from "express";
import Favorite from "../models/Favorite.js";
import Product from "../models/Product.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// GET /api/favorites/my → user favorites
router.get("/my", requireAuth, async (req, res) => {
  try {
    const favorites = await Favorite.find({ user: req.user.id })
      .populate("product")
      .lean();

    res.json(favorites);
  } catch (err) {
    console.error("FAVORITES FETCH ERROR:", err);
    res.status(500).json({ message: "Could not load favorites." });
  }
});

// POST /api/favorites/toggle
router.post("/toggle", requireAuth, async (req, res) => {
  try {
    const { productId } = req.body;

    if (!productId)
      return res.status(400).json({ message: "Product ID required." });

    // Check if already favorited
    const existing = await Favorite.findOne({
      user: req.user.id,
      product: productId,
    });

    if (existing) {
      await Favorite.findByIdAndDelete(existing._id);
      return res.json({ message: "Removed from favorites", favorite: false });
    }

    const newFav = await Favorite.create({
      user: req.user.id,
      product: productId,
    });

    return res.json({ message: "Added to favorites", favorite: true });
  } catch (err) {
    console.error("FAVORITE TOGGLE ERROR:", err);
    res.status(500).json({ message: "Failed to toggle favorite." });
  }
});

export default router;
