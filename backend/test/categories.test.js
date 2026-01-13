// backend/test/categories.test.js
import request from "supertest";
import { createTestApp } from "./testApp.js";
import { createUser, authHeaderFor } from "./helpers.js";
import Category from "../src/models/Category.js";
import Product from "../src/models/Product.js";

const app = createTestApp();

describe("CATEGORIES ROUTES", () => {
  test("1) GET /api/categories -> 200 public + response shape", async () => {
    const res = await request(app).get("/api/categories");
    expect(res.status).toBe(200);
    expect(res.body.items).toBeTruthy();
    expect(res.body.categories).toBeTruthy();
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(Array.isArray(res.body.categories)).toBe(true);
  });

  test("2) GET /api/categories -> merges product distinct categories", async () => {
    await Product.create({
      name: "P1",
      price: 10,
      category: "t-shirt",
      sizes: { XS: 1, S: 1, M: 1, L: 1, XL: 1 },

      // ✅ required
      model: "M1",
      serialNumber: "SN-cat-1",
      distributor: "D1",
      warrantyStatus: "12 months",
    });

    const res = await request(app).get("/api/categories");
    expect(res.status).toBe(200);
    const slugs = res.body.categories.map((x) => String(x));
    expect(slugs.join(" ")).toMatch(/t-shirt|tshirt|t\-shirt/i);
  });

  test("3) POST /api/categories -> 403 wrong role", async () => {
    const user = await createUser({ role: "customer", email: "cat1@test.com" });
    const res = await request(app).post("/api/categories").set(authHeaderFor(user)).send({ name: "Jeans" });
    expect(res.status).toBe(403);
  });

  test("4) POST /api/categories -> 400 missing name (productManager)", async () => {
    const pm = await createUser({ role: "productManager", email: "catpm@test.com" });
    const res = await request(app).post("/api/categories").set(authHeaderFor(pm)).send({});
    expect(res.status).toBe(400);
  });

  test("5) POST /api/categories -> 201 creates or upserts category", async () => {
    const pm = await createUser({ role: "productManager", email: "catpm2@test.com" });

    const res = await request(app).post("/api/categories").set(authHeaderFor(pm)).send({ name: "Sweat Shirt" });

    expect(res.status).toBe(201);
    expect(res.body.category).toBeTruthy();

    const inDb = await Category.findOne({ slug: "sweat-shirt" }).lean();
    expect(inDb).toBeTruthy();
  });
});
