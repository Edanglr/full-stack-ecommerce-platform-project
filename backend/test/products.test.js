// backend/test/products.test.js
import request from "supertest";
import Product from "../src/models/Product.js";
import Rating from "../src/models/Rating.js";

import { createTestApp } from "./testApp.js";
import { createUser, authHeaderFor } from "./helpers.js";

const app = createTestApp();

describe("PRODUCTS", () => {
  test("12) GET /api/products -> returns array", async () => {
    await Product.create({
      name: "Shirt",
      model: "M1",
      serialNumber: "S1",
      warrantyStatus: "12 months",
      distributor: "D1",
      price: 100,
      category: "t-shirt",
      sizes: { XS: 1, S: 1, M: 1, L: 1, XL: 1 },
    });

    const res = await request(app).get("/api/products");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
  });

  test("13) GET /api/products?sortBy=priceAsc -> sorted ascending", async () => {
    await Product.create([
      {
        name: "A",
        model: "m",
        serialNumber: "s",
        warrantyStatus: "12",
        distributor: "d",
        price: 200,
        category: "x",
        sizes: { M: 1 },
      },
      {
        name: "B",
        model: "m",
        serialNumber: "s2",
        warrantyStatus: "12",
        distributor: "d",
        price: 50,
        category: "x",
        sizes: { M: 1 },
      },
    ]);

    const res = await request(app).get("/api/products?sortBy=priceAsc");
    expect(res.status).toBe(200);
    expect(res.body[0].price).toBe(50);
    expect(res.body[1].price).toBe(200);
  });

  test("14) GET /api/products?category=JeAnS -> case-insensitive category match", async () => {
    await Product.create([
      {
        name: "J1",
        model: "m",
        serialNumber: "s1",
        warrantyStatus: "12",
        distributor: "d",
        price: 10,
        category: "jeans",
        sizes: { M: 1 },
      },
      {
        name: "T1",
        model: "m",
        serialNumber: "s2",
        warrantyStatus: "12",
        distributor: "d",
        price: 10,
        category: "t-shirt",
        sizes: { M: 1 },
      },
    ]);

    const res = await request(app).get("/api/products?category=JeAnS");
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].category.toLowerCase()).toBe("jeans");
  });

  test("15) GET /api/products/:id -> returns product + only approved comments", async () => {
    const p = await Product.create({
      name: "Hat",
      model: "M2",
      serialNumber: "S3",
      warrantyStatus: "12 months",
      distributor: "D2",
      price: 30,
      category: "accessory",
      sizes: { M: 1 },
    });

    await Rating.create([
      { productId: p._id, userId: "507f1f77bcf86cd799439099", score: 5, comment: "ok", isCommentApproved: true },
      { productId: p._id, userId: "507f1f77bcf86cd799439098", score: 4, comment: "no", isCommentApproved: false },
    ]);

    const res = await request(app).get(`/api/products/${p._id}`);
    expect(res.status).toBe(200);
    expect(res.body.product._id).toBe(String(p._id));
    expect(Array.isArray(res.body.comments)).toBe(true);
    expect(res.body.comments.length).toBe(1);
    expect(res.body.comments[0].comment).toBe("ok");
  });

  test("16) POST /api/products (manager) -> 400 if missing requirement-9 fields", async () => {
    const mgr = await createUser({ role: "manager", email: "mgr-prod1@test.com" });

    const res = await request(app)
      .post("/api/products")
      .set(authHeaderFor(mgr))
      .send({ name: "X", price: 10, category: "c" });

    // Auth OK, validation should fail
    expect(res.status).toBe(400);
  });

  test("17) POST /api/products (manager) -> 201 creates product", async () => {
    const mgr = await createUser({ role: "manager", email: "mgr-prod2@test.com" });

    const res = await request(app)
      .post("/api/products")
      .set(authHeaderFor(mgr))
      .send({
        name: "New",
        price: 99,
        category: "t-shirt",
        model: "MOD",
        serialNumber: "SER",
        warrantyStatus: "12 months",
        distributor: "DIST",
        sizes: { M: 5 },
      });

    expect(res.status).toBe(201);
    expect(res.body.product.name).toBe("New");
  });

  test("18) PUT /api/products/:id (manager) -> merges sizes", async () => {
    const mgr = await createUser({ role: "manager", email: "mgr-prod3@test.com" });

    const p = await Product.create({
      name: "P",
      model: "m",
      serialNumber: "s",
      warrantyStatus: "12",
      distributor: "d",
      price: 10,
      category: "c",
      sizes: { S: 1, M: 2 },
    });

    const res = await request(app)
      .put(`/api/products/${p._id}`)
      .set(authHeaderFor(mgr))
      .send({ sizes: { M: 9, L: 3 } });

    expect(res.status).toBe(200);
    expect(res.body.product.sizes.S).toBe(1);
    expect(res.body.product.sizes.M).toBe(9);
    expect(res.body.product.sizes.L).toBe(3);
  });
});
