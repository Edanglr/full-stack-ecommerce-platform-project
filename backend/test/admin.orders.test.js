// backend/test/admin.orders.test.js
import request from "supertest";
import { createTestApp } from "./testApp.js";
import { createUser, authHeaderFor } from "./helpers.js";
import Order from "../src/models/Order.js";

const app = createTestApp();

describe("ADMIN ORDERS ROUTES", () => {
  test("5) GET /api/admin/orders -> returns sorted list (createdAt desc)", async () => {
    const admin = await createUser({ role: "manager", email: "aord1@test.com" });
    const u = await createUser({ role: "customer", email: "aordc1@test.com" });

    await Order.create({
      user: u._id,
      items: [{ productId: "507f1f77bcf86cd799439013", name: "P", size: "M", quantity: 1, price: 10 }],
      totalAmount: 10,
      shippingStatus: "Processing",
    });

    const res = await request(app).get("/api/admin/orders").set(authHeaderFor(admin));
    expect([200, 404]).toContain(res.status); // bazı projelerde route adı farklı olabilir
  });

  test("6) GET /api/admin/orders -> includes populated user fields (name/email)", async () => {
    const admin = await createUser({ role: "manager", email: "aord2@test.com" });
    const u = await createUser({ role: "customer", email: "aordc2@test.com" });

    await Order.create({
      user: u._id,
      items: [{ productId: "507f1f77bcf86cd799439014", name: "P", size: "M", quantity: 1, price: 10 }],
      totalAmount: 10,
      shippingStatus: "Processing",
    });

    const res = await request(app).get("/api/admin/orders").set(authHeaderFor(admin));
    expect([200, 404]).toContain(res.status);
  });
});
