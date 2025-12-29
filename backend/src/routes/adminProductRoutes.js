// backend/src/routes/adminProductRoutes.js
import express from "express";
import Product from "../models/Product.js";
import { requireRole } from "../middleware/auth.js";

const router = express.Router();

// Get all products (admin) -> Product Manager
router.get("/", requireRole("productManager"), async (_req, res) => {
  try {
    const products = await Product.find({});
    res.json(products);
  } catch (err) {
    console.error("adminProductRoutes GET error:", err);
    res.status(500).json({ message: "Error fetching products" });
  }
});

// Create product -> Product Manager
router.post("/", requireRole("productManager"), async (req, res) => {
  try {
    const product = await Product.create(req.body);
    res.status(201).json(product);
  } catch (err) {
    console.error("adminProductRoutes POST error:", err);
    res.status(400).json({ message: "Error creating product", error: err });
  }
});

// Delete product -> Product Manager
router.delete("/:id", requireRole("productManager"), async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: "Product deleted" });
  } catch (err) {
    console.error("adminProductRoutes DELETE error:", err);
    res.status(500).json({ message: "Error deleting product" });
  }
});

export default router;
