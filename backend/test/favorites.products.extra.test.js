// backend/test/favorites.products.extra.test.js
import request from "supertest";
import express from "express";
import { jest } from "@jest/globals";

// ✅ 1) ESM-friendly mocks (NO require)
jest.unstable_mockModule("../src/middleware/auth.js", () => ({
  requireAuth: (req, _res, next) => {
    // default: user var gibi davran (test içinde override edebiliriz)
    req.user = req.user || { id: "u1" };
    next();
  },
}));

// Favorite model'i mocklayacağız (populate zinciri lazım)
const mockFind = jest.fn();
const mockFindOne = jest.fn();
const mockCreate = jest.fn();
const mockFindByIdAndDelete = jest.fn();

jest.unstable_mockModule("../src/models/Favorite.js", () => ({
  default: {
    find: mockFind,
    findOne: mockFindOne,
    create: mockCreate,
    findByIdAndDelete: mockFindByIdAndDelete,
  },
}));

// Product model bu testte zorunlu değil ama import ediliyorsa sorun olmasın
jest.unstable_mockModule("../src/models/Product.js", () => ({
  default: {},
}));

// ✅ 2) Import AFTER mocks
const { default: favoriteRoutes } = await import("../src/routes/favoriteRoutes.js");
const { default: Favorite } = await import("../src/models/Favorite.js");
const { requireAuth } = await import("../src/middleware/auth.js");

function makeApp({ attachUser } = {}) {
  const app = express();
  app.use(express.json());

  // test için requireAuth davranışını override edebilelim:
  app.use((req, res, next) => {
    if (typeof attachUser === "function") {
      attachUser(req);
    }
    next();
  });

  app.use("/api/favorites", favoriteRoutes);
  // basit error handler
  app.use((err, _req, res, _next) => {
    res.status(500).json({ message: err.message || "Server error" });
  });

  return app;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("EXTRA: favoriteRoutes + productRoutes", () => {
  test("GET /api/favorites/my -> if req.user missing -> 401", async () => {
    // ✅ requireAuth normalde user set ediyordu; bu testte user'ı özellikle sil
    const app = makeApp({
      attachUser: (req) => {
        // requireAuth çalışınca bile, route içinde kontrol var
        // bu yüzden req.user'ı undefined bırakıyoruz
        req.user = undefined;
      },
    });

    // route içinde requireAuth var ama biz üstte req.user'ı boş bıraktık
    const res = await request(app).get("/api/favorites/my");

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/not authenticated/i);
  });

  test("GET /api/favorites/my -> returns favorites array", async () => {
    const app = makeApp();

    // ✅ find().populate().lean() chain mock
    mockFind.mockReturnValue({
      populate: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([{ _id: "f1", product: { _id: "p1" } }]),
      }),
    });

    const res = await request(app).get("/api/favorites/my");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]._id).toBe("f1");
  });

  test("GET /api/favorites/my -> db error -> 500", async () => {
    const app = makeApp();

    mockFind.mockImplementation(() => {
      throw new Error("db down");
    });

    const res = await request(app).get("/api/favorites/my");

    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/could not load favorites/i);
  });

  test("POST /api/favorites/toggle -> missing productId -> 400", async () => {
    const app = makeApp();

    const res = await request(app).post("/api/favorites/toggle").send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/product id is required/i);
  });

  test("POST /api/favorites/toggle -> existing favorite -> removes -> 200", async () => {
    const app = makeApp();

    mockFindOne.mockResolvedValue({ _id: "fav1" });
    mockFindByIdAndDelete.mockResolvedValue({});

    const res = await request(app)
      .post("/api/favorites/toggle")
      .send({ productId: "p1" });

    expect(res.status).toBe(200);
    expect(res.body.favorite).toBe(false);
    expect(res.body.message).toMatch(/removed/i);
  });

  test("POST /api/favorites/toggle -> not existing -> creates -> 201", async () => {
    const app = makeApp();

    mockFindOne.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ _id: "fav2" });

    const res = await request(app)
      .post("/api/favorites/toggle")
      .send({ productId: "p1" });

    expect(res.status).toBe(201);
    expect(res.body.favorite).toBe(true);
    expect(res.body.message).toMatch(/added/i);
  });
});
