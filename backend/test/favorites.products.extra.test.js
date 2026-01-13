// backend/test/favorites.products.extra.test.js
import { jest } from "@jest/globals";
import express from "express";
import request from "supertest";

/** -----------------------
 *  Mocks (Models + Middleware)
 *  ---------------------- */
const Favorite = {
  find: jest.fn(),
  findOne: jest.fn(),
  findByIdAndDelete: jest.fn(),
  create: jest.fn(),
};

const Product = {
  find: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
};

const Rating = {
  find: jest.fn(),
};

// requireAuth: req.user inject
const requireAuth = (req, res, next) => {
  req.user = { id: "u1" };
  next();
};

// requireRole: allow always
const requireRole = () => (req, res, next) => next();

// ESM-friendly mocking
jest.unstable_mockModule("../src/models/Favorite.js", () => ({ default: Favorite }));
jest.unstable_mockModule("../src/models/Product.js", () => ({ default: Product }));
jest.unstable_mockModule("../src/models/Rating.js", () => ({ default: Rating }));
jest.unstable_mockModule("../src/middleware/auth.js", () => ({
  requireAuth,
  requireRole,
}));

const favoriteRouter = (await import("../src/routes/favoriteRoutes.js")).default;
const productRouter = (await import("../src/routes/productRoutes.js")).default;

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/favorites", favoriteRouter);
  app.use("/api/products", productRouter);
  return app;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("EXTRA: favoriteRoutes + productRoutes", () => {
  /** -----------------------
   *  FAVORITES (6 tests)
   *  ---------------------- */

  test("GET /api/favorites/my -> returns favorites list (200)", async () => {
    const fakeFavs = [{ _id: "f1", user: "u1", product: { _id: "p1", name: "Hoodie" } }];

    // Favorite.find().populate().lean()
    Favorite.find.mockReturnValueOnce({
      populate: jest.fn().mockReturnValueOnce({
        lean: jest.fn().mockResolvedValueOnce(fakeFavs),
      }),
    });

    const app = makeApp();
    const res = await request(app).get("/api/favorites/my");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]?.product?.name).toBe("Hoodie");
    expect(Favorite.find).toHaveBeenCalledWith({ user: "u1" });
  });

  test("GET /api/favorites/my -> if req.user missing -> 401", async () => {
    // Override middleware behavior just for this test:
    const badAuth = (req, res, next) => {
      req.user = null;
      next();
    };

    jest.unstable_mockModule("../src/middleware/auth.js", () => ({
      requireAuth: badAuth,
      requireRole,
    }));

    // re-import router with new mock
    const freshFavoriteRouter = (await import("../src/routes/favoriteRoutes.js?x=1")).default;

    const app = express();
    app.use(express.json());
    app.use("/api/favorites", freshFavoriteRouter);

    const res = await request(app).get("/api/favorites/my");
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/not authenticated/i);
  });

  test("GET /api/favorites/my -> model error -> 500", async () => {
    Favorite.find.mockImplementationOnce(() => {
      throw new Error("db down");
    });

    const app = makeApp();
    const res = await request(app).get("/api/favorites/my");
    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/could not load favorites/i);
  });

  test("POST /api/favorites/toggle -> missing productId -> 400", async () => {
    const app = makeApp();
    const res = await request(app).post("/api/favorites/toggle").send({});
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Product ID is required/i);
  });

  test("POST /api/favorites/toggle -> existing favorite => deletes + returns favorite:false (200)", async () => {
    Favorite.findOne.mockResolvedValueOnce({ _id: "fav1" });
    Favorite.findByIdAndDelete.mockResolvedValueOnce({ _id: "fav1" });

    const app = makeApp();
    const res = await request(app)
      .post("/api/favorites/toggle")
      .send({ productId: "p1" });

    expect(res.status).toBe(200);
    expect(res.body.favorite).toBe(false);
    expect(res.body.message).toMatch(/Removed from favorites/i);
    expect(Favorite.findByIdAndDelete).toHaveBeenCalledWith("fav1");
  });

  test("POST /api/favorites/toggle -> not existing => creates + returns favorite:true (201)", async () => {
    Favorite.findOne.mockResolvedValueOnce(null);
    Favorite.create.mockResolvedValueOnce({ _id: "fav2" });

    const app = makeApp();
    const res = await request(app)
      .post("/api/favorites/toggle")
      .send({ productId: "p1" });

    expect(res.status).toBe(201);
    expect(res.body.favorite).toBe(true);
    expect(res.body.message).toMatch(/Added to favorites/i);
    expect(Favorite.create).toHaveBeenCalledWith({ user: "u1", product: "p1" });
  });

  /** -----------------------
   *  PRODUCTS (4 tests)
   *  ---------------------- */

  test("GET /api/products?category=Jeans&sortBy=priceAsc -> calls Product.find with regex + sort asc", async () => {
    const sortMock = jest.fn().mockResolvedValueOnce([{ _id: "p1", name: "Jeans", price: 10 }]);

    Product.find.mockReturnValueOnce({
      sort: sortMock,
    });

    const app = makeApp();
    const res = await request(app).get("/api/products?category=Jeans&sortBy=priceAsc");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    // verify filter + sort used
    const [filterArg] = Product.find.mock.calls[0];
    expect(filterArg.category).toBeInstanceOf(RegExp);
    expect(String(filterArg.category)).toContain("^Jeans$");

    expect(sortMock).toHaveBeenCalledWith({ price: 1 });
  });

  test("GET /api/products/:id -> not found => 404", async () => {
    Product.findById.mockResolvedValueOnce(null);

    const app = makeApp();
    const res = await request(app).get("/api/products/doesnotexist");

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/Product not found/i);
  });

  test("GET /api/products/:id -> returns product + approved comments only (200)", async () => {
    Product.findById.mockResolvedValueOnce({ _id: "p1", name: "Hoodie" });

    // Rating.find().sort().populate()
    Rating.find.mockReturnValueOnce({
      sort: jest.fn().mockReturnValueOnce({
        populate: jest.fn().mockResolvedValueOnce([
          { _id: "c1", comment: "nice", isCommentApproved: true },
        ]),
      }),
    });

    const app = makeApp();
    const res = await request(app).get("/api/products/p1");

    expect(res.status).toBe(200);
    expect(res.body.product.name).toBe("Hoodie");
    expect(Array.isArray(res.body.comments)).toBe(true);

    // verify Rating.find filter includes approved comments
    const [ratingFilter] = Rating.find.mock.calls[0];
    expect(ratingFilter.productId).toBe("p1");
    expect(ratingFilter.isCommentApproved).toBe(true);
  });

  test("POST /api/products -> missing required fields => 400", async () => {
    const app = makeApp();

    const res = await request(app).post("/api/products").send({
      name: "X",
      // missing: price, category, model, serialNumber, warrantyStatus, distributor
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/required/i);
    expect(Product.create).not.toHaveBeenCalled();
  });
});
