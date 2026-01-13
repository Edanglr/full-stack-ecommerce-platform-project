// backend/test/favorites.products.extra.test.js
import request from "supertest";
import express from "express";

// ✅ IMPORTANT: mock models BEFORE importing routes
jest.mock("../src/models/Favorite.js", () => ({
  __esModule: true,
  default: {
    find: jest.fn(),
    findOne: jest.fn(),
    findByIdAndDelete: jest.fn(),
    create: jest.fn(),
  },
}));

// product model bu route'ta kullanılmıyor ama import var diye mocklamak güvenli
jest.mock("../src/models/Product.js", () => ({
  __esModule: true,
  default: {},
}));

// ✅ requireAuth middleware: testlerde req.user'ı kontrol edebilmek için esnek mock
jest.mock("../src/middleware/auth.js", () => ({
  __esModule: true,
  requireAuth: (req, _res, next) => {
    // testlerde header ile kullanıcı simüle edeceğiz
    const uid = req.headers["x-test-user"];
    if (uid) req.user = { id: uid };
    next();
  },
}));

import favoriteRoutes from "../src/routes/favoriteRoutes.js";
import Favorite from "../src/models/Favorite.js";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/favorites", favoriteRoutes);
  return app;
}

describe("EXTRA: favoriteRoutes (robust mocks)", () => {
  let app;

  beforeEach(() => {
    app = makeApp();
    jest.clearAllMocks();
  });

  describe("GET /api/favorites/my", () => {
    test("if user id missing -> 401", async () => {
      const res = await request(app).get("/api/favorites/my"); // no x-test-user header
      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/not authenticated/i);
    });

    test("returns favorites list (populate + lean chain)", async () => {
      const fakeFavs = [
        { _id: "f1", user: "u1", product: { _id: "p1", name: "X" } },
        { _id: "f2", user: "u1", product: { _id: "p2", name: "Y" } },
      ];

      // ✅ chain: find() -> { populate() -> { lean() -> Promise<...> } }
      Favorite.find.mockReturnValue({
        populate: () => ({
          lean: async () => fakeFavs,
        }),
      });

      const res = await request(app)
        .get("/api/favorites/my")
        .set("x-test-user", "u1");

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].product.name).toBe("X");
      expect(Favorite.find).toHaveBeenCalledWith({ user: "u1" });
    });

    test("db error -> 500", async () => {
      // ✅ find() chain içinde lean throw ettiriyoruz
      Favorite.find.mockReturnValue({
        populate: () => ({
          lean: async () => {
            throw new Error("db down");
          },
        }),
      });

      const res = await request(app)
        .get("/api/favorites/my")
        .set("x-test-user", "u1");

      expect(res.status).toBe(500);
      expect(res.body.message).toMatch(/could not load favorites/i);
    });
  });

  describe("POST /api/favorites/toggle", () => {
    test("missing productId -> 400", async () => {
      const res = await request(app)
        .post("/api/favorites/toggle")
        .set("x-test-user", "u1")
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/product id is required/i);
    });

    test("if favorite exists -> remove -> 200 favorite:false", async () => {
      Favorite.findOne.mockResolvedValue({ _id: "fav1" });
      Favorite.findByIdAndDelete.mockResolvedValue({});

      const res = await request(app)
        .post("/api/favorites/toggle")
        .set("x-test-user", "u1")
        .send({ productId: "p1" });

      expect(res.status).toBe(200);
      expect(res.body.favorite).toBe(false);
      expect(res.body.message).toMatch(/removed/i);
      expect(Favorite.findByIdAndDelete).toHaveBeenCalledWith("fav1");
    });

    test("if favorite not exists -> create -> 201 favorite:true", async () => {
      Favorite.findOne.mockResolvedValue(null);
      Favorite.create.mockResolvedValue({ _id: "newfav" });

      const res = await request(app)
        .post("/api/favorites/toggle")
        .set("x-test-user", "u1")
        .send({ productId: "p1" });

      expect(res.status).toBe(201);
      expect(res.body.favorite).toBe(true);
      expect(res.body.message).toMatch(/added/i);
      expect(Favorite.create).toHaveBeenCalledWith({ user: "u1", product: "p1" });
    });

    test("server error -> 500", async () => {
      Favorite.findOne.mockRejectedValue(new Error("boom"));

      const res = await request(app)
        .post("/api/favorites/toggle")
        .set("x-test-user", "u1")
        .send({ productId: "p1" });

      expect(res.status).toBe(500);
      expect(res.body.message).toMatch(/server error/i);
    });
  });
});
