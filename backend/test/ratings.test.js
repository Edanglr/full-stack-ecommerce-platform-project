// backend/test/ratings.test.js
import request from "supertest";

import Product from "../src/models/Product.js";
import Order from "../src/models/Order.js";
import Rating from "../src/models/Rating.js";

import { createTestApp } from "./testApp.js";
import { createUser, authHeaderFor } from "./helpers.js";

const app = createTestApp();

const makeProduct = async (over = {}) => {
  return Product.create({
    name: "P",
    model: "m",
    serialNumber: "s-" + Math.random().toString(16).slice(2),
    warrantyStatus: "12",
    distributor: "d",
    price: 10,
    category: "c",
    sizes: { M: 1 },
    ...over,
  });
};

describe("RATINGS", () => {
  test("19) GET /api/ratings/product/:productId -> 0,0 when no ratings", async () => {
    const p = await makeProduct();
    const res = await request(app).get(`/api/ratings/product/${p._id}`);
    expect(res.status).toBe(200);
    expect(res.body.averageRating).toBe(0);
    expect(res.body.ratingCount).toBe(0);
  });

  test("20) POST /api/ratings -> 400 if user has no delivered order", async () => {
    const customer = await createUser({ role: "customer", email: "rate20@test.com" });
    const p = await makeProduct();

    const res = await request(app)
      .post("/api/ratings")
      .set(authHeaderFor(customer))
      .send({ productId: String(p._id), score: 5, comment: "hi" });

    // Auth OK, but business rule should fail
    expect(res.status).toBe(400);
    expect(String(res.body.message || "")).toMatch(/only after.*delivered/i);
  });

  test("21) POST /api/ratings -> 201 creates rating when delivered order exists", async () => {
    const customer = await createUser({ role: "customer", email: "rate21@test.com" });
    const p = await makeProduct();

    await Order.create({
      user: customer._id,
      items: [{ productId: p._id, name: "P", size: "M", quantity: 1, price: 10 }],
      totalAmount: 10,
      shippingStatus: "Delivered",
    });

    const res = await request(app)
      .post("/api/ratings")
      .set(authHeaderFor(customer))
      .send({ productId: String(p._id), score: 4, comment: "good" });

    expect(res.status).toBe(201);
    expect(res.body.ratingCount).toBe(1);
    expect(res.body.averageRating).toBeCloseTo(4);
  });

  test("22) POST /api/ratings -> upsert updates existing rating (still 1 ratingCount)", async () => {
    const customer = await createUser({ role: "customer", email: "rate22@test.com" });
    const p = await makeProduct();

    await Order.create({
      user: customer._id,
      items: [{ productId: p._id, name: "P", size: "M", quantity: 1, price: 10 }],
      totalAmount: 10,
      shippingStatus: "Delivered",
    });

    await request(app)
      .post("/api/ratings")
      .set(authHeaderFor(customer))
      .send({ productId: String(p._id), score: 2, comment: "meh" });

    const res2 = await request(app)
      .post("/api/ratings")
      .set(authHeaderFor(customer))
      .send({ productId: String(p._id), score: 5, comment: "now great" });

    expect(res2.status).toBe(201);
    const all = await Rating.find({ productId: p._id });
    expect(all.length).toBe(1);
  });

  test("23) GET /api/ratings/admin/all -> 403 for customer", async () => {
    const customer = await createUser({ role: "customer", email: "rate23@test.com" });

    const res = await request(app).get("/api/ratings/admin/all").set(authHeaderFor(customer));
    expect(res.status).toBe(403);
  });

  test("24) PUT /api/ratings/approve/:id -> manager can approve comment", async () => {
    const manager = await createUser({ role: "manager", email: "rate24mgr@test.com" });
    const p = await makeProduct();

    const r = await Rating.create({
      productId: p._id,
      userId: String(manager._id),
      score: 5,
      comment: "approve me",
      isCommentApproved: false,
    });

    const res = await request(app)
      .put(`/api/ratings/approve/${r._id}`)
      .set(authHeaderFor(manager))
      .send({ approve: true });

    expect(res.status).toBe(200);
    expect(res.body.rating.isCommentApproved).toBe(true);
  });
});
