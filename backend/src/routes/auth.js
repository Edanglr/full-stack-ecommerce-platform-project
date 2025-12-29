// backend/src/routes/auth.js
import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const router = Router();

router.options("*", (_req, res) => res.sendStatus(200));

const signToken = (user) =>
  jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role || "customer",
      name: user.name,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES || "7d" }
  );

const setTokenCookie = (res, token) => {
  res.cookie("token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

/**
 * REGISTER (POST /api/auth/register)
 * body: { name, email, password }
 * ✅ role kabul etmiyoruz
 */
router.post("/register", async (req, res) => {
  try {
    const { email, password, name } = req.body || {};

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: "Name, email and password are required" });
    }

    const exists = await User.findOne({ email });
    if (exists) return res.status(409).json({ message: "Email already used" });

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await User.create({
      name: name.trim(),
      email,
      passwordHash,
      role: "customer",
    });

    const token = signToken(user);
    setTokenCookie(res, token);

    return res.status(201).json({
      token,
      user: { id: user._id, email: user.email, name: user.name, role: user.role },
    });
  } catch (e) {
    console.error("REGISTER ERROR:", e);
    return res.status(500).json({ message: "Register failed" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: "Invalid email or password" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ message: "Invalid email or password" });

    const token = signToken(user);
    setTokenCookie(res, token);

    return res.json({
      token,
      user: { id: user._id, email: user.email, name: user.name, role: user.role },
    });
  } catch (e) {
    console.error("LOGIN ERROR:", e);
    return res.status(500).json({ message: "Login failed" });
  }
});

router.post("/logout", (_req, res) => {
  res.clearCookie("token");
  return res.json({ message: "Logged out" });
});

export default router;
