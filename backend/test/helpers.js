// backend/test/helpers.js
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

import User from "../src/models/User.js";
import Product from "../src/models/Product.js";
import Order from "../src/models/Order.js";

/**
 * Creates a real user in DB (so requireAuth passes) and returns { user, token }.
 */
export async function seedUser({
  role = "customer",
  email = "user@test.com",
  name = "User",
} = {}) {
  const _id = new mongoose.Types.ObjectId();

  const user = await User.create({
    _id,
    name,
    email,
    role,
    passwordHash: "test_hash", // enough for tests
  });

  const token = jwt.sign(
    { id: String(user._id), email: user.email, role: user.role, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );

  return { user, token };
}

/**
 * Creates a product that satisfies your schema's required fields.
 * (Fixes model/serialNumber/distributor required errors.)
 */
export async function seedProduct(overrides = {}) {
  const base = {
    name: "Test Product",
    category: "t-shirt",
    price: 100,
    imageUrl: "http://example.com/p.png",

    // REQUIRED in your schema (based on test failures)
    model: "M1",
    serialNumber: "SN-" + Math.random().toString(16).slice(2),
    distributor: "Dist-1",

    // stock
    sizes: { XS: 0, S: 2, M: 2, L: 2, XL: 0 },
  };

  return Product.create({ ...base, ...overrides });
}

/**
 * Creates a Delivered order for rating tests etc.
 * Adjust fields if your Order schema differs.
 */
export async function seedDeliveredOrder({
  userId,
  productId,
  qty = 1,
  price = 100,
  size = "M",
  shippingStatus = "Delivered",
} = {}) {
  if (!userId) throw new Error("seedDeliveredOrder: userId is required");
  if (!productId) throw new Error("seedDeliveredOrder: productId is required");

  const totalAmount = qty * price;

  const order = await Order.create({
    user: userId,
    items: [
      {
        productId,
        name: "Item",
        price,
        size,
        quantity: qty,
        imageUrl: "http://example.com/i.png",
      },
    ],
    shippingStatus,
    totalAmount, // REQUIRED in your schema (based on failures)
    createdAt: new Date(),
  });

  return order;
}
