import request from "supertest";
import jwt from "jsonwebtoken";

import Product from "../src/models/Product.js";
import Order from "../src/models/Order.js";

import { createTestApp } from "./testApp.js";
const app = createTestApp();

// Mock utils used inside orderRoutes
jest.unstable_mockModule("../src/utils/mockBank.js", () => ({
  mockBankCharge: async ({ amount }) => (amount > 0 ? { success: true, transactionId: "T1", authCode: "OK00001" } : { success: false }),
}));
jest.unstable_mockModule("../src/utils/invoice.js", () => ({
  generateInvoicePdf: async () => ({ invoiceNumber: "INV-TEST-1", pdfPath: "/tmp/inv.pdf" }),
}));
jest.unstable_mockModule("../src/utils/email.js", () => ({
  sendInvoiceEmail: async () => true,
}));

function tokenCustomer(userId = "507f1f77bcf86cd799439020") {
  return jwt.sign({ id: userId, email: "c@test.com", role: "customer", name: "C" }, process.env.JWT_SECRET);
}
function tokenManager() {
  return jwt.sign({ id: "507f1f77bcf86cd799439021", email: "m@test.com", role: "manager", name: "M" }, process.env.JWT_SECRET);
}

describe("ORDERS", () => {
  test("25) POST /api/orders -> 400 if no items", async () => {
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${tokenCustomer()}`)
      .send({ items: [] });

    expect(res.status).toBe(400);
  });

  test("26) POST /api/orders -> 404 if product not found", async () => {
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${tokenCustomer()}`)
      .send({
        items: [{ productId: "507f1f77bcf86cd799439999", name: "X", size: "M", quantity: 1, price: 10 }],
      });

    expect(res.status).toBe(404);
  });

  test("27) POST /api/orders -> 400 if not enough stock", async () => {
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
      .post("/api/orders")
      .set("Authorization", `Bearer ${tokenCustomer()}`)
      .send({
        items: [{ productId: String(p._id), name: "P", size: "M", quantity: 2, price: 10 }],
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/not enough stock/i);
  });

  test("28) POST /api/orders -> 201 success decreases stock + returns invoice object", async () => {
    const p = await Product.create({
      name: "P",
      model: "m",
      serialNumber: "s",
      warrantyStatus: "12",
      distributor: "d",
      price: 10,
      category: "c",
      sizes: { M: 5 },
    });

    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${tokenCustomer("507f1f77bcf86cd799439022")}`)
      .send({
        deliveryAddress: "Istanbul",
        items: [{ productId: String(p._id), name: "P", size: "M", quantity: 2, price: 10 }],
      });

    expect(res.status).toBe(201);
    expect(res.body.trackingCode).toMatch(/^ORD-/);
    expect(res.body.invoice).toBeTruthy();

    const updated = await Product.findById(p._id).lean();
    expect(updated.sizes.M).toBe(3); // 5-2
  });

  test("29) PUT /api/orders/:id/status -> 400 invalid status", async () => {
    const o = await Order.create({
      user: "507f1f77bcf86cd799439023",
      items: [],
      totalAmount: 0,
    });

    const res = await request(app)
      .put(`/api/orders/${o._id}/status`)
      .set("Authorization", `Bearer ${tokenManager()}`)
      .send({ status: "WRONG" });

    expect(res.status).toBe(400);
  });
});
