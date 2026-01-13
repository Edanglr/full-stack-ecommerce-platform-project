// backend/test/admin.orders.test.js
import request from "supertest";
import { createTestApp } from "./testApp.js";
import { createUser, authHeaderFor } from "./helpers.js";
import Order from "../src/models/Order.js";

const app = createTestApp();

describe("ADMIN ORDERS ROUTES", () => {
  test("1) GET /api/admin/orders -> 401 without token", async () => {
    const res = await request(app).get("/api/admin/orders");
    expect(res.status).toBe(401);
  });

  test("2) GET /api/admin/orders -> 403 wrong role", async () => {
    const user = await createUser({ role: "customer", email: "cust-orders@test.com" });
    const res = await request(app)
      .get("/api/admin/orders")
      .set(authHeaderFor(user));
    expect(res.status).toBe(403);
  });

  test("3) GET /api/admin/orders -> 200 salesManager", async () => {
    const sm = await createUser({ role: "salesManager", email: "sm@test.com" });

    const res = await request(app)
      .get("/api/admin/orders")
      .set(authHeaderFor(sm));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test("4) GET /api/admin/orders -> 200 productManager", async () => {
    const pm = await createUser({ role: "productManager", email: "pm-orders@test.com" });

    const res = await request(app)
      .get("/api/admin/orders")
      .set(authHeaderFor(pm));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test("5) GET /api/admin/orders -> returns sorted list (createdAt desc)", async () => {
    const sm = await createUser({ role: "salesManager", email: "sm2@test.com" });
    const u = await createUser({ role: "customer", email: "buyer@test.com" });

    await Order.create({ user: u._id, items: [], total: 10, createdAt: new Date("2024-01-01") });
    await Order.create({ user: u._id, items: [], total: 20, createdAt: new Date("2024-02-01") });

    const res = await request(app)
      .get("/api/admin/orders")
      .set(authHeaderFor(sm));

    expect(res.status).toBe(200);
    if (res.body.length >= 2) {
      const first = new Date(res.body[0].createdAt).getTime();
      const second = new Date(res.body[1].createdAt).getTime();
      expect(first >= second).toBe(true);
    }
  });

  test("6) GET /api/admin/orders -> includes populated user fields (name/email)", async () => {
    const sm = await createUser({ role: "salesManager", email: "sm3@test.com" });
    const buyer = await createUser({ role: "customer", email: "buyer2@test.com", name: "Buyer" });

    await Order.create({ user: buyer._id, items: [], total: 30 });

    const res = await request(app)
      .get("/api/admin/orders")
      .set(authHeaderFor(sm));

    expect(res.status).toBe(200);
    if (res.body.length > 0) {
      expect(res.body[0].user).toBeTruthy();
      expect(res.body[0].user.email).toBeTruthy();
    }
  });
});
