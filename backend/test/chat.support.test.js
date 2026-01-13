// backend/test/chat.support.test.js
import request from "supertest";
import { createTestApp } from "./testApp.js";
import { createUser, authHeaderFor } from "./helpers.js";

import Chat from "../src/models/Chat.js";
import Product from "../src/models/Product.js";
import Order from "../src/models/Order.js";
import Favorite from "../src/models/Favorite.js";

const app = createTestApp();

describe("SUPPORT CHAT (Feature 13)", () => {
  test("1) GET /api/chat/admin/unclaimed -> 401 no token", async () => {
    const res = await request(app).get("/api/chat/admin/unclaimed");
    expect(res.status).toBe(401);
  });

  test("2) GET /api/chat/admin/unclaimed -> 403 wrong role", async () => {
    const u = await createUser({ role: "customer", email: "chatc@test.com" });
    const res = await request(app)
      .get("/api/chat/admin/unclaimed")
      .set(authHeaderFor(u));
    expect(res.status).toBe(403);
  });

  test("3) GET /api/chat/admin/unclaimed -> 200 supportAgent + returns unclaimed", async () => {
    const agent = await createUser({ role: "supportAgent", email: "agent1@test.com" });

    await Chat.create({
      chatId: "c1",
      customerId: "guest-123",
      claimedBy: null,
      status: "active",
      messages: [{ senderId: "guest-123", senderRole: "customer", text: "hi" }],
    });

    const res = await request(app)
      .get("/api/chat/admin/unclaimed")
      .set(authHeaderFor(agent));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  test("4) POST /api/chat/admin/claim/:chatId -> 404 if chat not found", async () => {
    const agent = await createUser({ role: "supportAgent", email: "agent2@test.com" });
    const res = await request(app)
      .post("/api/chat/admin/claim/NOPE")
      .set(authHeaderFor(agent));
    expect(res.status).toBe(404);
  });

  test("5) POST /api/chat/admin/claim/:chatId -> 200 claim ok", async () => {
    const agent = await createUser({ role: "supportAgent", email: "agent3@test.com" });

    await Chat.create({
      chatId: "claim1",
      customerId: "guest-999",
      claimedBy: null,
      status: "active",
      messages: [],
    });

    const res = await request(app)
      .post("/api/chat/admin/claim/claim1")
      .set(authHeaderFor(agent));

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/claimed/i);

    const updated = await Chat.findOne({ chatId: "claim1" }).lean();
    expect(updated.claimedBy).toBeTruthy();
  });

  test("6) POST /api/chat/admin/claim/:chatId -> 400 already claimed", async () => {
    const agent = await createUser({ role: "supportAgent", email: "agent4@test.com" });
    const agent2 = await createUser({ role: "supportAgent", email: "agent5@test.com" });

    await Chat.create({
      chatId: "claim2",
      customerId: "guest-111",
      claimedBy: agent._id,
      status: "active",
      messages: [],
    });

    const res = await request(app)
      .post("/api/chat/admin/claim/claim2")
      .set(authHeaderFor(agent2));

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already claimed/i);
  });

  test("7) GET /api/chat/user-details/:customerId -> guest returns placeholder", async () => {
    const agent = await createUser({ role: "supportAgent", email: "agent6@test.com" });

    const res = await request(app)
      .get("/api/chat/user-details/guest-abc")
      .set(authHeaderFor(agent));

    expect(res.status).toBe(200);
    expect(res.body.user).toBeTruthy();
    expect(res.body.user.isGuest).toBe(true);
    expect(Array.isArray(res.body.orders)).toBe(true);
  });

  test("8) GET /api/chat/user-details/:customerId -> returns orders + favorites for real user", async () => {
    const agent = await createUser({ role: "supportAgent", email: "agent7@test.com" });
    const customer = await createUser({ role: "customer", email: "realcust@test.com" });

    const p = await Product.create({
      name: "WishItem",
      price: 50,
      category: "jeans",
      sizes: { XS: 1, S: 1, M: 1, L: 1, XL: 1 },
    });

    await Favorite.create({ user: customer._id, product: p._id });
    await Order.create({ user: customer._id, items: [], total: 99, shippingStatus: "Shipped" });

    const res = await request(app)
      .get(`/api/chat/user-details/${customer._id}`)
      .set(authHeaderFor(agent));

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe("realcust@test.com");
    expect(Array.isArray(res.body.orders)).toBe(true);
    expect(Array.isArray(res.body.favorites)).toBe(true);
  });
});
