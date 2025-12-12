import request from "supertest";
import { createTestApp } from "./testApp.js";

const app = createTestApp();

test("GET /health returns ok", async () => {
  const res = await request(app).get("/health");
  expect(res.statusCode).toBe(200);
  expect(res.body.ok).toBe(true);
});
