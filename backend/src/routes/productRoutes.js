// backend/src/routes/productRoutes.js
import { Router } from "express";
import Product from "../models/Product.js";
import Rating from "../models/Rating.js";

const router = Router();

// GET all products (optional category + sorting)
router.get("/", async (req, res) => {
  try {
    const { category, sortBy } = req.query;

    const filter = {};
    if (category) {
      filter.category = new RegExp(`^${category}$`, "i");
    }

    let sort = {};
    switch (sortBy) {
      case "priceAsc":
        sort = { price: 1 };
        break;
      case "priceDesc":
        sort = { price: -1 };
        break;
      case "newest":
        sort = { createdAt: -1 };
        break;
      case "popularity":
        sort = { averageRating: -1, ratingCount: -1, createdAt: -1 };
        break;
      default:
        sort = { createdAt: -1 };
        break;
    }

    const products = await Product.find(filter).sort(sort);
    return res.json(products);
  } catch (err) {
    console.error("GET /api/products error:", err);
    return res.status(500).json({ message: "Error fetching products" });
  }
});

// GET product by id + approved comments
router.get("/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const comments = await Rating.find({
      productId: product._id,
      comment: { $ne: "" },
      isCommentApproved: true,
    })
      .sort({ createdAt: -1 })
      .populate("userId", "name email");

    return res.json({
      product,
      comments,
    });
  } catch (err) {
    console.error("GET /api/products/:id error:", err);
    return res.status(500).json({ message: "Error fetching product" });
  }
});

export default router;
