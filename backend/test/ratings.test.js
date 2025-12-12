import request from "supertest";
import jwt from "jsonwebtoken";

import Product from "../src/models/Product.js";
import Order from "../src/models/Order.js";
import Rating from "../src/models/Rating.js";

import { createTestApp } from "./testApp.js";
const app = createTestApp();

function tokenCustomer(userId = "507f1f77bcf86cd799439015") {
  return jwt.sign({ id: userId, email: "c@test.com", role: "customer", name: "C" }, process.env.JWT_SECRET);
}
function tokenManager() {
  return jwt.sign({ id: "507f1f77bcf86cd799439016", email: "m@test.com", role: "manager", name: "M" }, process.env.JWT_SECRET);
}

describe("RATINGS", () => {
  test("19) GET /api/ratings/product/:productId -> 0,0 when no ratings", async () => {
    const p = await Product.create({
      name: "P",
      model: "m",
      serialNumber: "s",
      warrantyStatus: "12",
      distributor: "d",
      price: 10,
      category: "c",
      sizes: { M: 1 },
    });

    const res = await request(app).get(`/api/ratings/product/${p._id}`);
    expect(res.status).toBe(200);
    expect(res.body.averageRating).toBe(0);
    expect(res.body.ratingCount).toBe(0);
  });

  test("20) POST /api/ratings -> 400 if user has no delivered order", async () => {
    const p = await Product.create({
      name: "P",
      model: "m",
      serialNumber: "s",
      warrantyStatus: "12",
      distributor: "d",
      price: 10,
      category: "c",
      sizes: { M: 1 },
    });

    const res = await request(app)
      .post("/api/ratings")
      .set("Authorization", `Bearer ${tokenCustomer()}`)
      .send({ productId: String(p._id), score: 5, comment: "hi" });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/only after.*delivered/i);
  });

  test("21) POST /api/ratings -> 201 creates rating when delivered order exists", async () => {
    const userId = "507f1f77bcf86cd799439017";
    const p = await Product.create({
      name: "P",
      model: "m",
      serialNumber: "s",
      warrantyStatus: "12",
      distributor: "d",
      price: 10,
      category: "c",
      sizes: { M: 1 },
    });

    await Order.create({
      user: userId,
      items: [{ productId: p._id, name: "P", size: "M", quantity: 1, price: 10 }],
      totalAmount: 10,
      shippingStatus: "Delivered",
    });

    const res = await request(app)
      .post("/api/ratings")
      .set("Authorization", `Bearer ${tokenCustomer(userId)}`)
      .send({ productId: String(p._id), score: 4, comment: "good" });

    expect(res.status).toBe(201);
    expect(res.body.ratingCount).toBe(1);
    expect(res.body.averageRating).toBeCloseTo(4);
  });

  test("22) POST /api/ratings -> upsert updates existing rating (still 1 ratingCount)", async () => {
    const userId = "507f1f77bcf86cd799439018";
    const p = await Product.create({
      name: "P",
      model: "m",
      serialNumber: "s",
      warrantyStatus: "12",
      distributor: "d",
      price: 10,
      category: "c",
      sizes: { M: 1 },
    });

    await Order.create({
      user: userId,
      items: [{ productId: p._id, name: "P", size: "M", quantity: 1, price: 10 }],
      totalAmount: 10,
      shippingStatus: "Delivered",
    });

    await request(app)
      .post("/api/ratings")
      .set("Authorization", `Bearer ${tokenCustomer(userId)}`)
      .send({ productId: String(p._id), score: 2, comment: "meh" });

    const res2 = await request(app)
      .post("/api/ratings")
      .set("Authorization", `Bearer ${tokenCustomer(userId)}`)
      .send({ productId: String(p._id), score: 5, comment: "now great" });

    expect(res2.status).toBe(201);
    const all = await Rating.find({ productId: p._id });
    expect(all.length).toBe(1);
  });

  test("23) GET /api/ratings/admin/all -> 403 for customer", async () => {
    const res = await request(app)
      .get("/api/ratings/admin/all")
      .set("Authorization", `Bearer ${tokenCustomer()}`);

    expect(res.status).toBe(403);
  });

  test("24) PUT /api/ratings/approve/:id -> manager can approve comment", async () => {
    const p = await Product.create({
      name: "P",
      model: "m",
      serialNumber: "s",
      warrantyStatus: "12",
      distributor: "d",
      price: 10,
      category: "c",
      sizes: { M: 1 },
    });

    const r = await Rating.create({
      productId: p._id,
      userId: "507f1f77bcf86cd799439019",
      score: 5,
      comment: "approve me",
      isCommentApproved: false,
    });

    const res = await request(app)
      .put(`/api/ratings/approve/${r._id}`)
      .set("Authorization", `Bearer ${tokenManager()}`)
      .send({ approve: true });

    expect(res.status).toBe(200);
    expect(res.body.rating.isCommentApproved).toBe(true);
  });
});
