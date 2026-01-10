// backend/server.js
import "dotenv/config";

import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import cookieParser from "cookie-parser";
import http from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";

import orderRoutes from "./src/routes/orderRoutes.js";
import authRoutes from "./src/routes/auth.js";
import productRoutes from "./src/routes/productRoutes.js";
import ratingRoutes from "./src/routes/ratingRoutes.js";
import userRoutes from "./src/routes/userRoutes.js";
import favoriteRoutes from "./src/routes/favoriteRoutes.js";
import returnRoutes from "./src/routes/returnRoutes.js";
import chatRoutes from "./src/routes/chatRoutes.js";
import chatSocket from "./src/socket/chatSocket.js";
import salesManagerRoutes from "./src/routes/salesManagerRoutes.js";
import categoryRoutes from "./src/routes/categoryRoutes.js";

// ✅ PAYMENT ROUTES EKLENDI
import paymentRoutes from "./src/routes/paymentRoutes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const PORT = process.env.PORT || 5050;
const ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:3000";

const corsOpts = {
  origin: ORIGIN,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOpts));
app.options("*", cors(corsOpts));

app.use(express.json());
app.use(cookieParser());

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// ==================== ROUTES ====================
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/ratings", ratingRoutes);
app.use("/api/users", userRoutes);
app.use("/api/favorites", favoriteRoutes);
app.use("/api/returns", returnRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/sales", salesManagerRoutes);
app.use("/api/categories", categoryRoutes);

// ✅ PAYMENT ROUTES
app.use("/api/payments", paymentRoutes);

// ==================== SOCKET.IO ====================
const io = new Server(server, {
  cors: {
    origin: ORIGIN,
    credentials: true,
  },
});

chatSocket(io);

// ==================== SERVER START ====================
const start = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    server.listen(PORT, () => {
      console.log(`🚀 Backend running on http://localhost:${PORT}`);
      console.log(`🌐 CORS origin: ${ORIGIN}`);
      console.log(`📋 Available routes:`);
      console.log(`   - /api/auth`);
      console.log(`   - /api/products`);
      console.log(`   - /api/orders`);
      console.log(`   - /api/payments ✅`);
      console.log(`   - /api/chats`);
      console.log(`   - /api/categories`);
    });
  } catch (err) {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  }
};

start();