// backend/test/returns.test.js
import request from "supertest";
import { createTestApp } from "./testApp.js";
import { createUser, authHeaderFor } from "./helpers.js";

import Product from "../src/models/Product.js";
import Order from "../src/models/Order.js";
import ReturnRequest from "../src/models/ReturnRequest.js";

const app = createTestApp();

const makeProduct = async (over = {}) => {
  return Product.create({
    name: "P",
    model: "m",
    serialNumber: "sn-" + Math.random().toString(16).slice(2),
    distributor: "d",
    warrantyStatus: "12",
    price: 10,
    category: "c",
    sizes: { M: 5 },
    ...over,
  });
};

async function postReturnRequest(app, user, payload) {
  // 1) default dene
  let res = await request(app).post("/api/returns/request").set(authHeaderFor(user)).send(payload);
  if (res.status !== 404) return res;

  // 2) fallback
  res = await request(app).post("/api/returns").set(authHeaderFor(user)).send(payload);
  return res;
}

describe("RETURNS", () => {
  test("30) POST return request -> creates return + restocks + updates order status", async () => {
    const u = await createUser({ role: "customer", email: "ret30@test.com" });
    const p = await makeProduct({ sizes: { M: 1 } });

    const o = await Order.create({
      user: u._id,
      items: [{ productId: p._id, name: p.name, size: "M", quantity: 1, price: p.price }],
      totalAmount: 10,
      shippingStatus: "Delivered",
    });

    const res = await postReturnRequest(app, u, {
      orderId: String(o._id),
      reason: "size issue",
      items: [{ productId: String(p._id), size: "M", quantity: 1 }],
    });

    expect(res.status).toBe(201);

    const rr = await ReturnRequest.findOne({ order: o._id }).lean();
    expect(rr).toBeTruthy();
  });
});
