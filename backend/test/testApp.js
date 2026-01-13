// backend/test/testApp.js
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import authRoutes from "../src/routes/auth.js";
import productRoutes from "../src/routes/productRoutes.js";
import ratingRoutes from "../src/routes/ratingRoutes.js";
import orderRoutes from "../src/routes/orderRoutes.js";
import favoriteRoutes from "../src/routes/favoriteRoutes.js";
import returnRoutes from "../src/routes/returnRoutes.js";
import userRoutes from "../src/routes/userRoutes.js";
import paymentRoutes from "../src/routes/paymentRoutes.js";

import adminProductRoutes from "../src/routes/adminProductRoutes.js";
import adminOrderRoutes from "../src/routes/adminOrderRoutes.js";

// ✅ NEW: mount these so we can test them
import chatRoutes from "../src/routes/chatRoutes.js";
import categoryRoutes from "../src/routes/categoryRoutes.js"; // (senin categories route dosya adın buysa)
import mailLogRoutes from "../src/routes/mailLogRoutes.js";
import salesManagerRoutes from "../src/routes/salesManagerRoutes.js";

export function createTestApp() {
  const app = express();

  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json());
  app.use(cookieParser());

  // Public routes
  app.use("/api/auth", authRoutes);
  app.use("/api/products", productRoutes);
  app.use("/api/ratings", ratingRoutes);
  app.use("/api/orders", orderRoutes);
  app.use("/api/favorites", favoriteRoutes);
  app.use("/api/returns", returnRoutes);
  app.use("/api/users", userRoutes);

  // ⚠️ You mounted payment as singular before:
  app.use("/api/payment", paymentRoutes);

  // Admin routes
  app.use("/api/admin/products", adminProductRoutes);
  app.use("/api/admin/orders", adminOrderRoutes);

  // ✅ NEW routes
  app.use("/api/chat", chatRoutes);
  app.use("/api/categories", categoryRoutes);
  app.use("/api/mail-logs", mailLogRoutes);
  app.use("/api/sales", salesManagerRoutes);

  app.get("/health", (_req, res) => res.status(200).json({ ok: true }));

  return app;
}
