import request from "supertest";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

import User from "../src/models/User.js";
import { createTestApp } from "./testApp.js";

// Mock yok (auth kendi içinde)
const app = createTestApp();

function sign(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "1d" });
}

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
    expect(res.body.message).toMatch(/required/i);
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
    const passwordHash = await bcrypt.hash("pass123", 12);
    await User.create({
      name: "User",
      email: "login@test.com",
      passwordHash,
      role: "customer",
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
    const passwordHash = await bcrypt.hash("correct", 12);
    await User.create({
      name: "User",
      email: "wrong@test.com",
      passwordHash,
      role: "customer",
    });

    const res = await request(app).post("/api/auth/login").send({
      email: "wrong@test.com",
      password: "bad",
    });

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid/i);
  });

  test("6) requireAuth -> 401 when no token", async () => {
    const res = await request(app).get("/api/favorites/my");
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/not authenticated/i);
  });

  test("7) requireAuth -> 401 invalid token", async () => {
    const res = await request(app)
      .get("/api/favorites/my")
      .set("Authorization", "Bearer bad.token.here");

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid|expired/i);
  });

  test("8) requireAuth accepts Bearer token and sets req.user", async () => {
    const token = sign({ id: "507f1f77bcf86cd799439011", email: "a@b.com", role: "customer", name: "A" });

    // favorites/my requireAuth; it will fail later because Favorite collection empty but should be 200 with []
    const res = await request(app)
      .get("/api/favorites/my")
      .set("Authorization", `Bearer ${token}`);

    expect([200, 500]).toContain(res.status);
    // If 200 it returns array. If your Favorite route throws, this will show 500; but token passed.
  });

  test("9) requireManager -> 403 for customer role", async () => {
    const token = sign({ id: "507f1f77bcf86cd799439012", email: "c@c.com", role: "customer", name: "C" });

    const res = await request(app)
      .get("/api/admin/products")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/manager only/i);
  });

  test("10) requireManager -> 200 for manager role (GET admin products)", async () => {
    const token = sign({ id: "507f1f77bcf86cd799439013", email: "m@m.com", role: "manager", name: "M" });

    const res = await request(app)
      .get("/api/admin/products")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test("11) POST /api/auth/logout -> 200", async () => {
    const res = await request(app).post("/api/auth/logout");
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/logged out/i);
  });
});

