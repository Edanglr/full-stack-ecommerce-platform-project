// backend/src/middleware/auth.js
import jwt from "jsonwebtoken";
import User from "../models/User.js";

// Token'ı cookie veya Authorization header'dan oku
const getTokenFromReq = (req) => {
  if (req.cookies?.token) return req.cookies.token;

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

// legacy manager -> her admin işini yapabilsin
const normalizeRole = (role) => role || "customer";

/**
 * ✅ requireRole artık şunları destekler:
 * - requireRole("salesManager", "productManager")
 * - requireRole(["salesManager","productManager"])
 * - requireRole("supportAgent")
 */
export const requireRole = (...rolesInput) => {
  const roles =
    rolesInput.length === 1 && Array.isArray(rolesInput[0])
      ? rolesInput[0]
      : rolesInput;

  return [
    requireAuth,
    (req, res, next) => {
      const role = normalizeRole(req.user?.role);

      // legacy bypass
      if (role === "manager") return next();

      if (!roles.length || !roles.includes(role)) {
        return res.status(403).json({ message: "Forbidden" });
      }
      next();
    },
  ];
};

// Convenience wrappers
export const requireSalesManager = requireRole("salesManager");
export const requireProductManager = requireRole("productManager");
export const requireSupportAgent = requireRole("supportAgent");

// Backward compatible "manager-like" group
export const requireManager = requireRole("salesManager", "productManager", "supportAgent");
