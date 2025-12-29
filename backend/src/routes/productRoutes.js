// backend/src/routes/productRoutes.js
import { Router } from "express";
import Product from "../models/Product.js";
import Rating from "../models/Rating.js";
import { requireRole } from "../middleware/auth.js";

const router = Router();

// GET all products
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

/**
 * POST /api/products
 * Product Manager: yeni ürün ekleme
 */
router.post("/", requireRole("productManager"), async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      category,
      imageUrl,
      stock,
      sizes,

      model,
      serialNumber,
      warrantyStatus,
      distributor,
    } = req.body;

    if (
      !name ||
      !price ||
      !category ||
      !model ||
      !serialNumber ||
      !warrantyStatus ||
      !distributor
    ) {
      return res.status(400).json({
        message:
          "name, price, category, model, serialNumber, warrantyStatus and distributor are required.",
      });
    }

    const product = await Product.create({
      name,
      description: description || "",
      price,
      category,
      imageUrl: imageUrl || "",
      stock: stock ?? 0,
      sizes: sizes || { XS: 0, S: 0, M: 0, L: 0, XL: 0 },

      model,
      serialNumber,
      warrantyStatus,
      distributor,
    });

    return res.status(201).json({
      message: "Product created.",
      product,
    });
  } catch (err) {
    console.error("POST /api/products error:", err);
    return res.status(500).json({ message: "Error while creating product." });
  }
});

/**
 * PUT /api/products/:id
 * Product Manager update
 */
router.put("/:id", requireRole("productManager"), async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      category,
      imageUrl,
      stock,
      sizes,

      model,
      serialNumber,
      warrantyStatus,
      distributor,
    } = req.body;

    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: "Product not found." });
    }

    if (name !== undefined) product.name = name;
    if (description !== undefined) product.description = description;
    if (price !== undefined) product.price = price;
    if (category !== undefined) product.category = category;
    if (imageUrl !== undefined) product.imageUrl = imageUrl;
    if (stock !== undefined) product.stock = stock;

    if (sizes !== undefined) {
      product.sizes = {
        ...((product.sizes?.toObject?.() ? product.sizes.toObject() : product.sizes) || {}),
        ...sizes,
      };
    }

    if (model !== undefined) product.model = model;
    if (serialNumber !== undefined) product.serialNumber = serialNumber;
    if (warrantyStatus !== undefined) product.warrantyStatus = warrantyStatus;
    if (distributor !== undefined) product.distributor = distributor;

    await product.save();

    return res.json({
      message: "Product updated.",
      product,
    });
  } catch (err) {
    console.error("PUT /api/products/:id error:", err);
    return res.status(500).json({ message: "Error while updating product." });
  }
});

export default router;
