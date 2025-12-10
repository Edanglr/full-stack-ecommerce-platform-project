import express from "express";
import Order from "../models/Order.js";
import { requireManager } from "../middleware/auth.js";

const router = express.Router();

router.get("/", requireManager, async (req, res) => {
  const orders = await Order.find({})
    .populate("user", "name email")
    .sort({ createdAt: -1 });

  res.json(orders);
});

export default router;
