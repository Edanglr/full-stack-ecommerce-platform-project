import express from "express";
import Favorite from "../models/Favorite.js"; // ✅ Capitalized based on your request
import Product from "../models/Product.js";   // ✅ Capitalized
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();


router.get("/my", requireAuth, async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      console.error("GET /my Error: User ID missing in request.");
      return res.status(401).json({ message: "User not authenticated." });
    }

    const favorites = await Favorite.find({ user: req.user.id })
      .populate("product")
      .lean();

    res.json(favorites);
  } catch (err) {
    console.error("Error fetching user favorites:", err);
    res.status(500).json({ message: "Could not load favorites." });
  }
});

router.post("/toggle", requireAuth, async (req, res) => {
  try {
    const { productId } = req.body;

    console.log("👉 Toggle request received for Product ID:", productId);
    console.log("👉 User ID:", req.user ? req.user.id : "No User Found");

    if (!productId) {
      return res.status(400).json({ message: "Product ID is required." });
    }

    // Check if the item is already in favorites
    const existingFavorite = await Favorite.findOne({
      user: req.user.id,
      product: productId,
    });

    if (existingFavorite) {
      // If exists, remove it
      await Favorite.findByIdAndDelete(existingFavorite._id);
      console.log("✅ Favorite removed.");
      return res.status(200).json({ 
        message: "Removed from favorites", 
        favorite: false 
      });
    }

    // If not exists, create new one
    await Favorite.create({
      user: req.user.id,
      product: productId,
    });

    console.log("✅ Favorite added.");
    return res.status(201).json({ 
      message: "Added to favorites", 
      favorite: true 
    });

  } catch (err) {
    console.error("FAVORITE TOGGLE ERROR:", err);
    res.status(500).json({ message: "Server error: " + err.message });
  }
});

export default router;