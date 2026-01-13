// backend/test/helpers.js
import jwt from "jsonwebtoken";
import User from "../src/models/User.js";

/**
 * Test için user üretir.
 * Not: projendeki User schema farklıysa (passwordHash vb),
 * burada minimal alanlarla çalışacak şekilde tutmaya çalıştım.
 */
export async function createUser(overrides = {}) {
  const {
    email = `u_${Date.now()}_${Math.random().toString(16).slice(2)}@test.com`,
    name = "Test User",
    role = "customer",
    passwordHash = "testhash",
    ...rest
  } = overrides;

  // Bazı projelerde User schema passwordHash ister, bazılarında istemez.
  // O yüzden hem deniyoruz, hata olursa passwordHash'siz deniyoruz.
  try {
    return await User.create({ email, name, role, passwordHash, ...rest });
  } catch (e) {
    return await User.create({ email, name, role, ...rest });
  }
}

/**
 * ✅ Authorization header üretir.
 * requireAuth artık DB'den user çektiği için token'ın id'si gerçek user olmalı.
 */
export function authHeaderFor(user) {
  const token = jwt.sign(
    {
      id: String(user._id),
      email: user.email,
      role: user.role || "customer",
      name: user.name || "User",
    },
    process.env.JWT_SECRET
  );

  return { Authorization: `Bearer ${token}` };
}

/**
 * Bazı testlerde direkt string header gerekebiliyor diye (opsiyonel).
 */
export function bearerFor(user) {
  const h = authHeaderFor(user);
  return h.Authorization;
}
