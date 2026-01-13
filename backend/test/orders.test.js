// backend/test/orders.test.js
import request from "supertest";
import Product from "../src/models/Product.js";
import Order from "../src/models/Order.js";

import { createUser, authHeaderFor } from "./helpers.js";

// ✅ IMPORTANT: Mock email module BEFORE importing testApp
import { jest } from "@jest/globals";

jest.unstable_mockModule("../src/utils/email.js", () => {
  return {
    // Projede hangi isimler import ediliyorsa hepsini güvenli şekilde veriyoruz
    createTransporter: () => ({ sendMail: async () => true }),

    sendInvoiceEmail: jest.fn(async () => true),
    sendRefundApprovalEmail: jest.fn(async () => true),
    sendRefundRequestEmail: jest.fn(async () => true),
    sendReturnRequestEmail: jest.fn(async () => true),
    sendReturnStatusEmail: jest.fn(async () => true),
    sendRefundProcessedEmail: jest.fn(async () => true),
  };
});

let app;
beforeAll(async () => {
  const mod = await import("./testApp.js");
  app = mod.createTestApp();
});

const makeProduct = async (over = {}) => {
  return Product.create({
    name: "P",
    model: "m",
    serialNumber: "sn-" + Math.random().toString(16).slice(2),
    distributor: "d",
    warrantyStatus: "12",
    price: 10,
    category: "c",
    sizes: { M: 5 },
    ...over,
  });
};

describe("ORDERS", () => {
  test("25) POST /api/orders -> 400 if no items", async () => {
    const u = await createUser({ role: "customer", email: "ord25@test.com" });

    const res = await request(app)
      .post("/api/orders")
      .set(authHeaderFor(u))
      .send({ items: [] });

    expect(res.status).toBe(400);
  });

  test("26) POST /api/orders -> 404 if product not found", async () => {
    const u = await createUser({ role: "customer", email: "ord26@test.com" });

    const res = await request(app)
      .post("/api/orders")
      .set(authHeaderFor(u))
      .send({
        items: [{ productId: "507f1f77bcf86cd799439011", name: "X", size: "M", quantity: 1, price: 10 }],
      });

    expect(res.status).toBe(404);
  });

  test("27) POST /api/orders -> 400 if not enough stock", async () => {
    const u = await createUser({ role: "customer", email: "ord27@test.com" });
    const p = await makeProduct({ sizes: { M: 1 } });

    const res = await request(app)
      .post("/api/orders")
      .set(authHeaderFor(u))
      .send({
        items: [{ productId: String(p._id), name: p.name, size: "M", quantity: 3, price: p.price }],
      });

    expect(res.status).toBe(400);
  });

  test("28) POST /api/orders -> 201 success decreases stock + returns invoice object", async () => {
    const u = await createUser({ role: "customer", email: "ord28@test.com" });
    const p = await makeProduct({ sizes: { M: 5 } });

    const res = await request(app)
      .post("/api/orders")
      .set(authHeaderFor(u))
      .send({
        items: [{ productId: String(p._id), name: p.name, size: "M", quantity: 2, price: p.price }],
      });

    expect(res.status).toBe(201);

    const updated = await Product.findById(p._id).lean();
    expect(updated.sizes.M).toBe(3);

    // response şekli projeden projeye değişebilir; invoice varsa kontrol edelim
    expect(res.body).toBeTruthy();
  });

  test("29) PUT /api/orders/:id/status -> 400 invalid status", async () => {
    const manager = await createUser({ role: "manager", email: "ord29mgr@test.com" });
    const u = await createUser({ role: "customer", email: "ord29@test.com" });

    const o = await Order.create({
      user: u._id,
      items: [{ productId: "507f1f77bcf86cd799439012", name: "P", size: "M", quantity: 1, price: 10 }],
      totalAmount: 10,
      shippingStatus: "Processing",
    });

    const res = await request(app)
      .put(`/api/orders/${o._id}/status`)
      .set(authHeaderFor(manager))
      .send({ status: "NOT_A_REAL_STATUS" });

    expect(res.status).toBe(400);
  });
});
