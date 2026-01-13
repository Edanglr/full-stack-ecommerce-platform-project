// backend/test/admin.products.test.js
import request from "supertest";
import { createTestApp } from "./testApp.js";
import { createUser, authHeaderFor } from "./helpers.js";
import Product from "../src/models/Product.js";

const app = createTestApp();

describe("ADMIN PRODUCTS ROUTES", () => {
  test("4) POST /api/admin/products -> 201/200 create product (productManager)", async () => {
    const pm = await createUser({ role: "productManager", email: "apm@test.com" });

    const res = await request(app)
      .post("/api/admin/products")
      .set(authHeaderFor(pm))
      .send({
        name: "AdminP",
        category: "t-shirt",
        price: 10,
        sizes: { M: 2 },

        // ✅ schema required
        model: "m",
        serialNumber: "sn",
        distributor: "d",
        warrantyStatus: "12",
      });

    expect([201, 200]).toContain(res.status);
    expect(res.body._id || res.body.product?._id).toBeTruthy();
  });

  test("6) DELETE /api/admin/products/:id -> 200 delete (productManager)", async () => {
    const pm = await createUser({ role: "productManager", email: "apm2@test.com" });

    const p = await Product.create({
      name: "ToDelete",
      category: "t-shirt",
      price: 10,
      sizes: { M: 1 },
      model: "m",
      serialNumber: "sn-" + Math.random().toString(16).slice(2),
      distributor: "d",
      warrantyStatus: "12",
    });

    const res = await request(app)
      .delete(`/api/admin/products/${p._id}`)
      .set(authHeaderFor(pm));

    expect([200, 204]).toContain(res.status);
  });
});
