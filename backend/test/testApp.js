import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

// routes
import authRoutes from "../src/routes/auth.js";
import productRoutes from "../src/routes/productRoutes.js";
import ratingRoutes from "../src/routes/ratingRoutes.js";
import orderRoutes from "../src/routes/orderRoutes.js";
import favoriteRoutes from "../src/routes/favoriteRoutes.js";
import returnRoutes from "../src/routes/returnRoutes.js";
import userRoutes from "../src/routes/userRoutes.js";
import adminProductRoutes from "../src/routes/adminProductRoutes.js";
import adminOrderRoutes from "../src/routes/adminOrderRoutes.js";

export const createTestApp = () => {
  const app = express();

  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json());
  app.use(cookieParser());

  app.use("/api/auth", authRoutes);
  app.use("/api/products", productRoutes);
  app.use("/api/ratings", ratingRoutes);
  app.use("/api/orders", orderRoutes);
  app.use("/api/favorites", favoriteRoutes);
  app.use("/api/returns", returnRoutes);
  app.use("/api/users", userRoutes);

  app.use("/api/admin/products", adminProductRoutes);
  app.use("/api/admin/orders", adminOrderRoutes);

  app.get("/health", (_req, res) => res.json({ ok: true }));

  return app;
};
