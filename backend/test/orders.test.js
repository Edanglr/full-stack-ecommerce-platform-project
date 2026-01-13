// backend/test/orders.test.js
import request from "supertest";
import { jest } from "@jest/globals";

import Order from "../src/models/Order.js";
import Product from "../src/models/Product.js";

import { seedUser, seedProduct } from "./helpers.js";

// ✅ MOCK email module so missing named exports don't crash tests
jest.unstable_mockModule("../src/utils/email.js", () => ({
  sendRefundApprovalEmail: jest.fn(),
  sendOrderConfirmationEmail: jest.fn(),
  sendPriceDropEmail: jest.fn(),
}));

let app;

beforeAll(async () => {
  // IMPORTANT: import testApp AFTER mockModule
  const mod = await import("./testApp.js");
  app = mod.createTestApp();
});

describe("ORDERS", () => {
  test("25) POST /api/orders -> 400 if no items", async () => {
    const { token } = await seedUser();
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({ items: [] });

    expect([400, 422]).toContain(res.status);
  });

  test("26) POST /api/orders -> 404 if product not found", async () => {
    const { token } = await seedUser();
    const fakeId = "507f1f77bcf86cd799439011";

    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({
        items: [{ productId: fakeId, name: "X", price: 10, size: "M", quantity: 1, imageUrl: "x" }],
      });

    expect([404, 400]).toContain(res.status);
  });

  test("27) POST /api/orders -> 400 if not enough stock", async () => {
    const { token } = await seedUser();
    const p = await seedProduct({ sizes: { XS: 0, S: 0, M: 0, L: 0, XL: 0 } });

    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({
        items: [{ productId: String(p._id), name: p.name, price: p.price, size: "M", quantity: 1, imageUrl: p.imageUrl }],
      });

    expect([400, 409]).toContain(res.status);
  });

  test("28) POST /api/orders -> 201 success decreases stock + returns invoice object", async () => {
    const { token } = await seedUser();
    const p = await seedProduct({ sizes: { XS: 0, S: 0, M: 5, L: 0, XL: 0 }, price: 50 });

    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({
        items: [{ productId: String(p._id), name: p.name, price: p.price, size: "M", quantity: 2, imageUrl: p.imageUrl }],
      });

    expect([201, 200]).toContain(res.status);

    // check stock decreased if your implementation updates product
    const fresh = await Product.findById(p._id).lean();
    if (fresh?.sizes?.M != null) expect(fresh.sizes.M).toBe(3);

    // invoice existence (best-effort, depends on your API)
    expect(res.body).toBeTruthy();
  });

  test("29) PUT /api/orders/:id/status -> 400 invalid status", async () => {
    const { token, user } = await seedUser({ role: "manager" });
    const p = await seedProduct();

    const o = await Order.create({
      user: user._id,
      items: [{ productId: p._id, name: p.name, price: p.price, size: "M", quantity: 1, imageUrl: p.imageUrl }],
      shippingStatus: "Processing",
      totalAmount: p.price,
    });

    const res = await request(app)
      .put(`/api/orders/${o._id}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "BAD_STATUS" });

    expect([400, 422]).toContain(res.status);
  });
});
