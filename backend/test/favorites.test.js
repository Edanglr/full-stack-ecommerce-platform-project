// backend/test/favorites.test.js
import request from "supertest";
import { createTestApp } from "./testApp.js";
import { createUser, authHeaderFor } from "./helpers.js";
import Product from "../src/models/Product.js";
import Favorite from "../src/models/Favorite.js";

const app = createTestApp();

describe("FAVORITES ROUTES", () => {
  test("1) GET /api/favorites/my -> 401 no token", async () => {
    const res = await request(app).get("/api/favorites/my");
    expect(res.status).toBe(401);
  });

  test("2) GET /api/favorites/my -> 200 returns []", async () => {
    const u = await createUser({ role: "customer", email: "fav1@test.com" });
    const res = await request(app)
      .get("/api/favorites/my")
      .set(authHeaderFor(u));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test("3) POST /api/favorites/toggle -> 400 missing productId", async () => {
    const u = await createUser({ role: "customer", email: "fav2@test.com" });
    const res = await request(app)
      .post("/api/favorites/toggle")
      .set(authHeaderFor(u))
      .send({});
    expect(res.status).toBe(400);
  });

  test("4) POST /api/favorites/toggle -> 201 adds favorite", async () => {
    const u = await createUser({ role: "customer", email: "fav3@test.com" });
    const p = await Product.create({
      name: "FavProd",
      price: 10,
      category: "jeans",
      sizes: { XS: 1, S: 1, M: 1, L: 1, XL: 1 },
    });

    const res = await request(app)
      .post("/api/favorites/toggle")
      .set(authHeaderFor(u))
      .send({ productId: String(p._id) });

    expect([201, 200]).toContain(res.status);
    const count = await Favorite.countDocuments({ user: u._id, product: p._id });
    expect(count).toBe(1);
  });

  test("5) POST /api/favorites/toggle -> 200 removes favorite if exists", async () => {
    const u = await createUser({ role: "customer", email: "fav4@test.com" });
    const p = await Product.create({
      name: "FavProd2",
      price: 15,
      category: "jeans",
      sizes: { XS: 1, S: 1, M: 1, L: 1, XL: 1 },
    });
    await Favorite.create({ user: u._id, product: p._id });

    const res = await request(app)
      .post("/api/favorites/toggle")
      .set(authHeaderFor(u))
      .send({ productId: String(p._id) });

    expect(res.status).toBe(200);
    const count = await Favorite.countDocuments({ user: u._id, product: p._id });
    expect(count).toBe(0);
  });

  test("6) GET /api/favorites/my -> returns populated product", async () => {
    const u = await createUser({ role: "customer", email: "fav5@test.com" });
    const p = await Product.create({
      name: "FavProd3",
      price: 20,
      category: "t-shirt",
      sizes: { XS: 1, S: 1, M: 1, L: 1, XL: 1 },
    });
    await Favorite.create({ user: u._id, product: p._id });

    const res = await request(app)
      .get("/api/favorites/my")
      .set(authHeaderFor(u));

    expect(res.status).toBe(200);
    expect(res.body[0].product).toBeTruthy();
    expect(res.body[0].product.name).toBe("FavProd3");
  });
});
