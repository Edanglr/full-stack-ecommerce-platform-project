// backend/test/admin.products.test.js
import request from "supertest";
import Product from "../src/models/Product.js";
import { createTestApp } from "./testApp.js";
import { createUser, authHeaderFor } from "./helpers.js";

const app = createTestApp();

describe("ADMIN PRODUCTS ROUTES", () => {
  test("1) GET /api/admin/products -> 401/403 without token", async () => {
    const res = await request(app).get("/api/admin/products");
    expect([401, 403]).toContain(res.status);
  });

  test("2) GET /api/admin/products -> 403 with wrong role", async () => {
    const user = await createUser({ role: "customer", email: "c1@test.com" });
    const res = await request(app)
      .get("/api/admin/products")
      .set(authHeaderFor(user));
    expect(res.status).toBe(403);
  });

  test("3) GET /api/admin/products -> 200 with productManager", async () => {
    const pm = await createUser({ role: "productManager", email: "pm1@test.com" });
    const res = await request(app)
      .get("/api/admin/products")
      .set(authHeaderFor(pm));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test("4) POST /api/admin/products -> 201 create product (productManager)", async () => {
    const pm = await createUser({ role: "productManager", email: "pm2@test.com" });

    const res = await request(app)
      .post("/api/admin/products")
      .set(authHeaderFor(pm))
      .send({
        name: "Hoodie",
        price: 999,
        category: "sweatshirt",
        sizes: { XS: 1, S: 2, M: 3, L: 4, XL: 5 },
        imageUrl: "x.png",
      });

    expect([201, 200]).toContain(res.status);
    expect(res.body._id).toBeTruthy();
  });

  test("5) POST /api/admin/products -> 400 invalid body (productManager)", async () => {
    const pm = await createUser({ role: "productManager", email: "pm3@test.com" });
    const res = await request(app)
      .post("/api/admin/products")
      .set(authHeaderFor(pm))
      .send({}); // invalid
    expect([400, 422]).toContain(res.status);
  });

  test("6) DELETE /api/admin/products/:id -> 200 delete (productManager)", async () => {
    const pm = await createUser({ role: "productManager", email: "pm4@test.com" });
    const p = await Product.create({
      name: "ToDelete",
      price: 10,
      category: "t-shirt",
      sizes: { XS: 1, S: 1, M: 1, L: 1, XL: 1 },
    });

    const res = await request(app)
      .delete(`/api/admin/products/${p._id}`)
      .set(authHeaderFor(pm));

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/deleted/i);
  });
});
