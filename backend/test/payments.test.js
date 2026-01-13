// backend/test/payments.test.js
import request from "supertest";
import { createTestApp } from "./testApp.js";
import { createUser, authHeaderFor } from "./helpers.js";
import PaymentMethod from "../src/models/PaymentMethod.js";

const app = createTestApp();

describe("PAYMENT ROUTES", () => {
  test("1) GET /api/payment/my -> 401 no token", async () => {
    const res = await request(app).get("/api/payment/my");
    expect(res.status).toBe(401);
  });

  test("2) POST /api/payment/add -> 400 missing fields", async () => {
    const u = await createUser({ role: "customer", email: "pay1@test.com" });
    const res = await request(app)
      .post("/api/payment/add")
      .set(authHeaderFor(u))
      .send({ cardNumber: "1234" });
    expect(res.status).toBe(400);
  });

  test("3) POST /api/payment/add -> 201 adds method + masks", async () => {
    const u = await createUser({ role: "customer", email: "pay2@test.com" });
    const res = await request(app)
      .post("/api/payment/add")
      .set(authHeaderFor(u))
      .send({ cardNumber: "4111111111111111", expiry: "12/30", cvv: "123" });

    expect(res.status).toBe(201);
    expect(res.body.method.last4).toBe("1111");
    expect(res.body.method.cardNumberMasked).toMatch(/\*{4}/);
  });

  test("4) GET /api/payment/my -> returns user methods", async () => {
    const u = await createUser({ role: "customer", email: "pay3@test.com" });
    await PaymentMethod.create({
      user: u._id,
      cardNumberMasked: "**** **** **** 9999",
      last4: "9999",
      expiry: "01/40",
    });

    const res = await request(app)
      .get("/api/payment/my")
      .set(authHeaderFor(u));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].last4).toBe("9999");
  });

  test("5) DELETE /api/payment/:id -> 403 if not owner", async () => {
    const owner = await createUser({ role: "customer", email: "pay4@test.com" });
    const other = await createUser({ role: "customer", email: "pay5@test.com" });

    const pm = await PaymentMethod.create({
      user: owner._id,
      cardNumberMasked: "**** **** **** 1111",
      last4: "1111",
      expiry: "10/30",
    });

    const res = await request(app)
      .delete(`/api/payment/${pm._id}`)
      .set(authHeaderFor(other));

    expect(res.status).toBe(403);
  });

  test("6) DELETE /api/payment/:id -> 200 removes if owner", async () => {
    const owner = await createUser({ role: "customer", email: "pay6@test.com" });

    const pm = await PaymentMethod.create({
      user: owner._id,
      cardNumberMasked: "**** **** **** 2222",
      last4: "2222",
      expiry: "10/30",
    });

    const res = await request(app)
      .delete(`/api/payment/${pm._id}`)
      .set(authHeaderFor(owner));

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/removed/i);

    const still = await PaymentMethod.findById(pm._id);
    expect(still).toBeNull();
  });
});
