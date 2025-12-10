// backend/src/middleware/auth.js
import jwt from "jsonwebtoken";

export const requireAuth = (req, res, next) => {
  try {
    let token = null;

    // 1) Authorization: Bearer xxx
    const authHeader = req.headers.authorization || "";
    if (authHeader.startsWith("Bearer ")) {
      token = authHeader.slice(7);
    }

    // 2) Cookie'den
    if (!token && req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);

    req.user = {
      id: payload.id,
      email: payload.email,
      role: payload.role || "customer",
      name: payload.name,
    };

    return next();
  } catch (err) {
    console.error("requireAuth error:", err.message);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

export const requireManager = (req, res, next) => {
  // requireAuth daha önce çalışmamışsa token'ı tekrar kontrol et
  if (!req.user) {
    return requireAuth(req, res, () => {
      if (!req.user || req.user.role !== "manager") {
        return res.status(403).json({ message: "Manager only" });
      }
      return next();
    });
  }

  if (req.user.role !== "manager") {
    return res.status(403).json({ message: "Manager only" });
  }

  return next();
};

