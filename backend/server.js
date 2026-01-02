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

// Route Importları
import orderRoutes from "./src/routes/orderRoutes.js";
import authRoutes from "./src/routes/auth.js";
import productRoutes from "./src/routes/productRoutes.js";
import ratingRoutes from "./src/routes/ratingRoutes.js";
import userRoutes from "./src/routes/userRoutes.js";
import favoriteRoutes from "./src/routes/favoriteRoutes.js";
import returnRoutes from "./src/routes/returnRoutes.js";
import chatRoutes from "./src/routes/chatRoutes.js";
import chatSocket from "./src/socket/chatSocket.js";

// ✅ SALES MANAGER (discount + invoices range + analytics)
import salesManagerRoutes from "./src/routes/salesManagerRoutes.js";

// 📂 __dirname Tanımlaması (ES Modülleri için zorunlu)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

// 📂 STATİK DOSYA ERİŞİMİ
// Yüklenen chat dosyalarına http://localhost:5050/uploads/... üzerinden erişimi sağlar
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

// Health check
app.get("/api/health", (_req, res) => res.json({ ok: true }));

// API ROUTES
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/ratings", ratingRoutes);
app.use("/api/users", userRoutes);
app.use("/api/favorites", favoriteRoutes);
app.use("/api/returns", returnRoutes);
app.use("/api/chats", chatRoutes);

// ✅ Sales Manager routes
app.use("/api/sales", salesManagerRoutes);

// 🔌 SOCKET.IO
const io = new Server(server, {
  cors: {
    origin: ORIGIN,
    credentials: true,
  },
});

chatSocket(io);

// 🚀 START
const start = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✓ Connected to MongoDB");

    server.listen(PORT, () => {
      console.log(`✓ Backend running on http://localhost:${PORT}`);
      console.log(`✓ CORS origin: ${ORIGIN}`);
    });
  } catch (err) {
    console.error("✗ MongoDB connection error:", err.message);
    process.exit(1);
  }
};

start();
