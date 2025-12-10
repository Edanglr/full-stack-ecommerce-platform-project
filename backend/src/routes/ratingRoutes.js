// backend/src/routes/ratingRoutes.js
import { Router } from "express";
import Rating from "../models/Rating.js";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import { requireAuth, requireManager } from "../middleware/auth.js";

const router = Router();

/**
 * GET /api/ratings/product/:productId
 * -> average rating & rating count
 */
router.get("/product/:productId", async (req, res) => {
  try {
    const { productId } = req.params;

    const ratings = await Rating.find({ productId });

    if (!ratings.length) {
      return res.json({
        averageRating: 0,
        ratingCount: 0,
      });
    }

    const total = ratings.reduce((sum, r) => sum + r.score, 0);
    const averageRating = total / ratings.length;

    return res.json({
      averageRating,
      ratingCount: ratings.length,
    });
  } catch (err) {
    console.error("GET /api/ratings/product/:productId error:", err);
    return res
      .status(500)
      .json({ message: "Error while fetching ratings." });
  }
});

/**
 * POST /api/ratings
 * -> sadece Delivered order varsa rating/comment
 */
router.post("/", requireAuth, async (req, res) => {
  try {
    const { productId, score, comment } = req.body;

    if (!productId || !score) {
      return res
        .status(400)
        .json({ message: "productId and score are required." });
    }

    // Bu kullanıcı için, bu ürünü içeren Delivered sipariş var mı?
    const deliveredOrder = await Order.findOne({
      user: req.user.id,
      shippingStatus: /delivered/i,
      "items.productId": productId,
    });

    if (!deliveredOrder) {
      return res.status(400).json({
        message:
          "You can rate and comment on this product only after an order containing it has been delivered.",
      });
    }

    const rating = await Rating.findOneAndUpdate(
      { productId, userId: req.user.id },
      {
        productId,
        userId: req.user.id,
        orderId: deliveredOrder._id,
        score,
        comment: comment || "",
        ...(comment ? { isCommentApproved: false } : {}),
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    );

    // Yeni ortalama
    const allRatings = await Rating.find({ productId });
    const total = allRatings.reduce((sum, r) => sum + r.score, 0);
    const averageRating = total / (allRatings.length || 1);

    await Product.findByIdAndUpdate(productId, {
      averageRating,
      ratingCount: allRatings.length,
    });

    return res.status(201).json({
      message:
        rating.comment && rating.comment.trim()
          ? "Rating & comment saved. Comment awaits manager approval."
          : "Rating saved.",
      averageRating,
      ratingCount: allRatings.length,
    });
  } catch (err) {
    console.error("POST /api/ratings error:", err);

    if (err.code === 11000) {
      return res
        .status(409)
        .json({ message: "You have already rated this product." });
    }

    return res.status(500).json({ message: "Error while saving rating." });
  }
});

/**
 * GET /api/ratings/admin/all
 * -> tüm rating + yorumlar (manager)
 */
router.get("/admin/all", requireManager, async (_req, res) => {
  try {
    const ratings = await Rating.find({})
      .sort({ createdAt: -1 })
      .populate("productId", "name")
      .populate("userId", "name email");

    return res.json(ratings);
  } catch (err) {
    console.error("GET /api/ratings/admin/all error:", err);
    return res
      .status(500)
      .json({ message: "Error while fetching all ratings." });
  }
});

/**
 * PUT /api/ratings/approve/:id
 * body: { approve: true/false }
 */
router.put("/approve/:id", requireManager, async (req, res) => {
  try {
    const { approve } = req.body;
    const { id } = req.params;

    const rating = await Rating.findById(id);
    if (!rating) {
      return res.status(404).json({ message: "Rating not found." });
    }

    rating.isCommentApproved = !!approve;
    await rating.save();

    return res.json({
      message: approve ? "Comment approved." : "Comment rejected.",
      rating,
    });
  } catch (err) {
    console.error("PUT /api/ratings/approve/:id error:", err);
    return res
      .status(500)
      .json({ message: "Error while approving/rejecting comment." });
  }
});

export default router;
