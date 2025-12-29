import jwt from "jsonwebtoken";
import User from "../models/User.js";

// Token'ı cookie veya Authorization header'dan oku
const getTokenFromReq = (req) => {
  // cookie
  if (req.cookies?.token) return req.cookies.token;

  // bearer
  const auth = req.headers.authorization;
  if (auth && auth.startsWith("Bearer ")) return auth.slice(7);

  return null;
};

export const requireAuth = async (req, res, next) => {
  try {
    const token = getTokenFromReq(req);
    if (!token) return res.status(401).json({ message: "Unauthorized" });

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.id).select("-passwordHash");

    if (!user) return res.status(401).json({ message: "Unauthorized" });

    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ message: "Unauthorized" });
  }
};

// Eski "manager" rolünü legacy olarak kabul edip admin yetkisi gibi kullanacağız.
const normalizeRole = (role) => role || "customer";

export const requireRole = (roles = []) => [
  requireAuth,
  (req, res, next) => {
    const role = normalizeRole(req.user?.role);

    // legacy manager -> her admin işini yapabilsin (geriye uyumluluk)
    if (role === "manager") return next();

    if (!roles.includes(role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  },
];

// PDF rolleri
export const requireSalesManager = requireRole(["salesManager"]);
export const requireProductManager = requireRole(["productManager"]);
export const requireSupportAgent = requireRole(["supportAgent"]);

// Kodun eski yerleri kırılmasın diye (adminProductRoutes/adminOrderRoutes vs.)
export const requireManager = requireRole(["salesManager", "productManager", "supportAgent"]);
