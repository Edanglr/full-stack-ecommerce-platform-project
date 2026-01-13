// backend/test/helpers.js
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import User from "../src/models/User.js";

export function sign(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "1d" });
}

export async function createUser({
  name = "Test User",
  email = "test@test.com",
  password = "pass123",
  role = "customer",
} = {}) {
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ name, email, passwordHash, role });
  return user;
}

export function authHeaderFor(user) {
  const token = sign({
    id: String(user._id),
    role: user.role,
    email: user.email,
    name: user.name,
  });
  return { Authorization: `Bearer ${token}` };
}
