// backend/src/routes/userRoutes.js

import express from "express";
import User from "../models/User.js";
// DÜZELTME 1: Süslü parantez { } ekledik
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// ⭐ GET /api/users/me → kullanıcı bilgilerini getir
router.get("/me", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-passwordHash");

    if (!user) return res.status(404).json({ message: "User not found" });

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});


router.put("/update", requireAuth, async (req, res) => {
  try {
    const { name, address, city, postalCode, phone } = req.body;

    const updated = await User.findByIdAndUpdate(
      req.user.id,
      { name, address, city, postalCode, phone },
      { new: true }
    ).select("-passwordHash");

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: "Update failed" });
  }
});

export default router;