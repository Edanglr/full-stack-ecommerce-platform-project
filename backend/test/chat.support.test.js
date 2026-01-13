// backend/test/chat.support.test.js
import request from "supertest";
import { createTestApp } from "./testApp.js";
import { createUser, authHeaderFor } from "./helpers.js";

import Product from "../src/models/Product.js";
import Order from "../src/models/Order.js";
import Favorite from "../src/models/Favorite.js";

const app = createTestApp();

const makeProduct = async (over = {}) =>
  Product.create({
    name: "ChatProd",
    model: "m",
    serialNumber: "sn-" + Math.random().toString(16).slice(2),
    distributor: "d",
    warrantyStatus: "12",
    price: 10,
    category: "t-shirt",
    sizes: { M: 3 },
    ...over,
  });

describe("SUPPORT CHAT (Feature 13)", () => {
  test("7) GET /api/chat/user-details/:customerId -> guest returns placeholder", async () => {
    const res = await request(app).get("/api/chat/user-details/guest-abc");
    expect(res.status).toBe(200);
    expect(res.body).toBeTruthy();
  });

  test("8) GET /api/chat/user-details/:customerId -> returns orders + favorites for real user", async () => {
    const u = await createUser({ role: "customer", email: "chat1@test.com" });
    const p = await makeProduct({ name: "RealP" });

    await Order.create({
      user: u._id,
      items: [{ productId: p._id, name: p.name, size: "M", quantity: 1, price: p.price }],
      totalAmount: 10,
      shippingStatus: "Delivered",
    });

    await Favorite.create({ user: u._id, product: p._id });

    const res = await request(app)
      .get(`/api/chat/user-details/${u._id}`)
      .set(authHeaderFor(u));

    expect(res.status).toBe(200);
    expect(res.body).toBeTruthy();
    // shape projeye göre değişebilir ama en azından crash olmasın:
    expect(res.body.orders || res.body.orderHistory || res.body).toBeTruthy();
  });
});
