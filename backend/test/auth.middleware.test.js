// backend/test/auth.middleware.test.js
import request from "supertest";
import { createTestApp } from "./testApp.js";
import { seedUser } from "./helpers.js";

const app = createTestApp();

describe("AUTH + MIDDLEWARE", () => {
  test("1) POST /api/auth/register -> 201 creates user + returns token", async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "Nisa",
      email: "nisa@test.com",
      password: "123456",
    });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.email).toBe("nisa@test.com");
  });

  test("2) POST /api/auth/register -> 400 missing fields", async () => {
    const res = await request(app).post("/api/auth/register").send({
      email: "x@test.com",
    });
    expect(res.status).toBe(400);
    expect(String(res.body.message || "")).toMatch(/required/i);
  });

  test("3) POST /api/auth/register -> 409 duplicate email", async () => {
    await request(app).post("/api/auth/register").send({
      name: "A",
      email: "dup@test.com",
      password: "123456",
    });

    const res2 = await request(app).post("/api/auth/register").send({
      name: "B",
      email: "dup@test.com",
      password: "123456",
    });

    expect(res2.status).toBe(409);
  });

  test("4) POST /api/auth/login -> 200 correct creds", async () => {
    // Use real register then login so it matches your auth implementation
    await request(app).post("/api/auth/register").send({
      name: "User",
      email: "login@test.com",
      password: "pass123",
    });

    const res = await request(app).post("/api/auth/login").send({
      email: "login@test.com",
      password: "pass123",
    });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.email).toBe("login@test.com");
  });

  test("5) POST /api/auth/login -> 401 wrong password", async () => {
    await request(app).post("/api/auth/register").send({
      name: "User",
      email: "wrong@test.com",
      password: "correct",
    });

    const res = await request(app).post("/api/auth/login").send({
      email: "wrong@test.com",
      password: "bad",
    });

    expect(res.status).toBe(401);
    expect(String(res.body.message || "")).toMatch(/unauthorized|invalid/i);
  });

  test("6) requireAuth -> 401 when no token", async () => {
    const res = await request(app).get("/api/favorites/my");
    expect(res.status).toBe(401);
    expect(String(res.body.message || "")).toMatch(/unauthorized/i);
  });

  test("7) requireAuth -> 401 invalid token", async () => {
    const res = await request(app)
      .get("/api/favorites/my")
      .set("Authorization", "Bearer bad.token.here");

    expect(res.status).toBe(401);
    expect(String(res.body.message || "")).toMatch(/unauthorized/i);
  });

  test("8) requireAuth accepts Bearer token and sets req.user (favorites/my)", async () => {
    const { token } = await seedUser({ role: "customer", email: "a@b.com", name: "A" });

    const res = await request(app)
      .get("/api/favorites/my")
      .set("Authorization", `Bearer ${token}`);

    // should be 200 even if empty list
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test("9) requireManager -> 403 for customer role", async () => {
    const { token } = await seedUser({ role: "customer", email: "c@c.com", name: "C" });

    const res = await request(app)
      .get("/api/admin/products")
      .set("Authorization", `Bearer ${token}`);

    // role check should forbid
    expect([403, 401]).toContain(res.status);
  });

  test("10) requireManager -> 200 for manager role (GET admin products)", async () => {
    const { token } = await seedUser({ role: "manager", email: "m@m.com", name: "M" });

    const res = await request(app)
      .get("/api/admin/products")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test("11) POST /api/auth/logout -> 200", async () => {
    const res = await request(app).post("/api/auth/logout");
    expect(res.status).toBe(200);
    expect(String(res.body.message || "")).toMatch(/logged out/i);
  });
});
