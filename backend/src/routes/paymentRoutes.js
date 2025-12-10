import express from "express";
import PaymentMethod from "../models/PaymentMethod.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

/**
 * GET /api/payments/my
 * Get logged-in user's payment methods
 */
router.get("/my", requireAuth, async (req, res) => {
  try {
    const methods = await PaymentMethod.find({ user: req.user.id }).lean();
    return res.json(methods);
  } catch (err) {
    console.error("GET PAYMENT METHODS ERROR:", err);
    return res.status(500).json({
      message: "Error fetching payment methods.",
    });
  }
});

/**
 * POST /api/payments/add
 * Add a new payment method
 */
router.post("/add", requireAuth, async (req, res) => {
  try {
    const { cardNumber, expiry, cvv } = req.body;

    if (!cardNumber || !expiry || !cvv) {
      return res.status(400).json({ message: "All fields are required." });
    }

    // Mask card number
    const last4 = cardNumber.slice(-4);
    const masked = "**** **** **** " + last4;

    const pm = await PaymentMethod.create({
      user: req.user.id,
      cardNumberMasked: masked,
      last4,
      expiry,
    });

    return res.status(201).json({
      message: "Payment method saved.",
      method: pm,
    });
  } catch (err) {
    console.error("ADD PAYMENT METHOD ERROR:", err);
    return res.status(500).json({
      message: "Failed to save payment method.",
    });
  }
});

/**
 * DELETE /api/payments/:id
 * Delete a saved payment method
 */
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const method = await PaymentMethod.findById(req.params.id);

    if (!method) {
      return res.status(404).json({
        message: "Payment method not found.",
      });
    }

    // Verify owner
    if (method.user.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        message: "Not authorized.",
      });
    }

    await PaymentMethod.findByIdAndDelete(req.params.id);

    return res.json({
      message: "Payment method removed.",
    });
  } catch (err) {
    console.error("DELETE PAYMENT METHOD ERROR:", err);
    return res.status(500).json({
      message: "Failed to delete payment method.",
    });
  }
});

export default router;
