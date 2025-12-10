import express from "express";
import Product from "../models/Product.js";
import { requireManager } from "../middleware/auth.js";

const router = express.Router();

// Get all products (admin)
router.get("/", requireManager, async (req, res) => {
  const products = await Product.find({});
  res.json(products);
});

// Create product
router.post("/", requireManager, async (req, res) => {
  try {
    const product = await Product.create(req.body);
    res.status(201).json(product);
  } catch (err) {
    res.status(400).json({ message: "Error creating product", error: err });
  }
});

// Delete product
router.delete("/:id", requireManager, async (req, res) => {
  await Product.findByIdAndDelete(req.params.id);
  res.json({ message: "Product deleted" });
});

export default router;
