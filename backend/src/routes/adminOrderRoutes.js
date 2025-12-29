// backend/src/routes/adminOrderRoutes.js
import express from "express";
import Order from "../models/Order.js";
import { requireRole } from "../middleware/auth.js";

const router = express.Router();

// Tüm siparişleri görme:
// - Sales Manager: finance/invoice tarafı
// - Product Manager: delivery/ops tarafı
router.get("/", requireRole("salesManager", "productManager"), async (_req, res) => {
  try {
    const orders = await Order.find({})
      .populate("user", "name email")
      .sort({ createdAt: -1 });

    res.json(orders);
  } catch (err) {
    console.error("adminOrderRoutes GET error:", err);
    res.status(500).json({ message: "Error fetching orders" });
  }
});

export default router;
