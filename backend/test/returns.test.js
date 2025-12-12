import request from "supertest";
import jwt from "jsonwebtoken";

import Product from "../src/models/Product.js";
import Order from "../src/models/Order.js";
import ReturnRequest from "../src/models/returnModel.js";

import { createTestApp } from "./testApp.js";
const app = createTestApp();

function tokenCustomer(userId = "507f1f77bcf86cd799439024") {
  return jwt.sign({ id: userId, email: "c@test.com", role: "customer", name: "C" }, process.env.JWT_SECRET);
}

describe("RETURNS", () => {
  test("30) POST /api/returns/request -> creates return + restocks + updates order status", async () => {
    const userId = "507f1f77bcf86cd799439025";

    const p = await Product.create({
      name: "P",
      model: "m",
      serialNumber: "s",
      warrantyStatus: "12",
      distributor: "d",
      price: 10,
      category: "c",
      sizes: { M: 1 },
    });

    const o = await Order.create({
      user: userId,
      items: [{ productId: p._id, name: "P", size: "M", quantity: 1, price: 10 }],
      totalAmount: 10,
      shippingStatus: "Delivered",
      shippingHistory: [],
    });

    // önce stok 1 iken return request stok +1 yapacak => 2
    const res = await request(app)
      .post("/api/returns/request")
      .set("Authorization", `Bearer ${tokenCustomer(userId)}`)
      .send({
        orderId: String(o._id),
        productId: String(p._id),
        size: "M",
        quantity: 1,
        reason: "Size mismatch",
      });

    expect(res.status).toBe(201);

    const rr = await ReturnRequest.findOne({ order: o._id }).lean();
    expect(rr).toBeTruthy();
    expect(rr.status).toBe("Requested");

    const updatedOrder = await Order.findById(o._id).lean();
    expect(updatedOrder.shippingStatus).toMatch(/Return requested/i);

    const updatedProduct = await Product.findById(p._id).lean();
    expect(updatedProduct.sizes.M).toBe(2);
  });
});
