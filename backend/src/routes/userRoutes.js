// backend/src/routes/userRoutes.js

import express from "express";
import User from "../models/User.js";
import { requireAuth } from "../middleware/auth.js";
import bcrypt from "bcryptjs";

const router = express.Router();

router.get("/me", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-passwordHash");

    if (!user) return res.status(404).json({ message: "User not found" });

    res.json(user);
  } catch (err) {
    console.error("GET ME ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});


router.get("/cart/:userId", requireAuth, requireRole("supportAgent", "productManager"), async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .select("cart")
      .populate({
        path: "cart.items.productId",
        select: "name price imageUrl image"
      });

    if (!user) return res.status(404).json({ message: "User not found" });

    // Sepet verisini döndür (eğer boşsa boş dizi gönder)
    res.json(user.cart || { items: [] });
  } catch (err) {
    console.error("Fetch user cart error:", err);
    res.status(500).json({ message: "Error fetching user cart" });
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
    console.error("PROFILE UPDATE ERROR:", err);
    res.status(500).json({ message: "Update failed" });
  }
});

/**
 * PUT /api/users/change-email
 * Change account email (requires password)
 */
router.put("/change-email", requireAuth, async (req, res) => {
  try {
    const { newEmail, password } = req.body;

    if (!newEmail || !password) {
      return res.status(400).json({ message: "Missing fields." });
    }

    const user = await User.findById(req.user.id);

    // Check password
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(400).json({ message: "Incorrect password." });
    }

    // Update email
    user.email = newEmail;
    await user.save();

    return res.json({ message: "Email updated successfully." });
  } catch (err) {
    console.error("CHANGE EMAIL ERROR:", err);
    return res.status(500).json({ message: "Server error." });
  }
});

/**
 * PUT /api/users/change-password
 * Change user password
 */
router.put("/change-password", requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Missing fields." });
    }

    const user = await User.findById(req.user.id);

    // Verify current password
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      return res.status(400).json({ message: "Incorrect current password." });
    }

    // Hash new password
    const hashed = await bcrypt.hash(newPassword, 10);
    user.passwordHash = hashed;

    await user.save();

    return res.json({ message: "Password updated successfully." });
  } catch (err) {
    console.error("CHANGE PASSWORD ERROR:", err);
    return res.status(500).json({ message: "Server error." });
  }
});

export default router;
