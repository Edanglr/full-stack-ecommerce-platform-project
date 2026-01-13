// backend/test/helpers.js
import jwt from "jsonwebtoken";
import User from "../src/models/User.js";

export async function createUser(overrides = {}) {
  const {
    email = `u_${Date.now()}_${Math.random().toString(16).slice(2)}@test.com`,
    name = "Test User",
    role = "customer",
    passwordHash = "testhash",
    ...rest
  } = overrides;

  try {
    return await User.create({ email, name, role, passwordHash, ...rest });
  } catch {
    return await User.create({ email, name, role, ...rest });
  }
}

// ✅ auth middleware testleri seedUser istiyor
export async function seedUser(overrides = {}) {
  return createUser(overrides);
}

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

export function bearerFor(user) {
  return authHeaderFor(user).Authorization;
}
