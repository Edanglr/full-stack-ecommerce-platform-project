import express from "express";
import ReturnRequest from "../models/returnModel.js";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import { requireAuth, requireSalesManager } from "../middleware/auth.js";
import { sendRefundApprovalEmail } from "../utils/email.js";

const router = express.Router();

/**
 * CUSTOMER: Create return request
 * POST /api/returns
 */
router.post("/", requireAuth, async (req, res) => {
  try {
    const { orderId, productId, size, quantity, reason } = req.body;

    console.log("👉 İade İsteği Geldi:", { orderId, productId, reason });

    if (!orderId || !productId || !reason) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    const userId = req.user.id || req.user._id;

    const order = await Order.findById(orderId);
    if (!order) {
      console.log("❌ Sipariş bulunamadı.");
      return res.status(404).json({ message: "Order not found." });
    }

    if (order.user?.toString() !== userId.toString()) {
      console.log("❌ Sipariş bu kullanıcıya ait değil.");
      return res.status(403).json({ message: "Not authorized." });
    }

    // ✅ Must be delivered to request return (Kod2 özelliği)
    const ship = String(order.shippingStatus || "").toLowerCase();
    if (ship !== "delivered") {
      return res
        .status(400)
        .json({ message: "You can only return delivered orders." });
    }

    // ✅ Validate item exists in order (productId / product toleransı: Kod1)
    const orderItem = (order.items || []).find((it) => {
      const itemProdId = it.product || it.productId;
      const sameProd = String(itemProdId) === String(productId);
      const sameSize = !size || String(it.size || "") === String(size || "");
      return sameProd && sameSize;
    });

    if (!orderItem) {
      console.log("❌ Ürün sipariş içinde bulunamadı. Order Items:", order.items);
      return res
        .status(400)
        .json({ message: "This product is not part of the order." });
    }

    const finalSize = (size || orderItem.size || "").toString();
    const finalQty = Number(quantity || orderItem.quantity || 1);

    if (!finalSize) {
      return res.status(400).json({ message: "Size is required for return." });
    }
    if (!finalQty || finalQty <= 0) {
      return res.status(400).json({ message: "Invalid quantity." });
    }

    // ✅ Prevent duplicates (Kod2: order+product+size)
    const existingReturn = await ReturnRequest.findOne({
      order: orderId,
      product: productId,
      size: finalSize,
    });

    if (existingReturn) {
      return res
        .status(400)
        .json({ message: "Return request already created for this item." });
    }

    const returnRequest = await ReturnRequest.create({
      user: userId,
      order: orderId,
      product: productId,
      size: finalSize,
      quantity: finalQty,
      reason,
      status: "Requested",
    });

    // ✅ Shipping history note (Kod1 + Kod2)
    order.shippingHistory = order.shippingHistory || [];
    order.shippingHistory.push({
      date: new Date(),
      status: `Return requested: ${reason}`,
    });
    await order.save();

    // ✅ IMPORTANT:
    // Stock should NOT be increased here.
    // Stock should be increased only after Sales Manager approves.
    // (Kod2 yaklaşımı: doğru akış)

    console.log("✅ İade talebi başarıyla oluşturuldu.");
    return res.status(201).json(returnRequest);
  } catch (err) {
    console.error("🔥 RETURN REQUEST ERROR:", err);
    return res.status(500).json({ message: "Server error: " + err.message });
  }
});

/**
 * CUSTOMER: My returns
 * GET /api/returns/my
 * -> Kod1'in imageUrl fix'i korunur
 */
router.get("/my", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;

    const returns = await ReturnRequest.find({ user: userId })
      .populate("product", "name imageUrl image price")
      .populate("order", "_id trackingCode")
      .sort({ createdAt: -1 })
      .lean();

    const formattedReturns = (returns || []).map((ret) => ({
      ...ret,
      product: ret.product
        ? {
            ...ret.product,
            imageUrl:
              ret.product?.imageUrl ||
              ret.product?.image ||
              "https://via.placeholder.com/80?text=No+Image",
          }
        : ret.product,
    }));

    return res.json(formattedReturns);
  } catch (err) {
    console.error("GET MY RETURNS ERROR:", err);
    return res.status(500).json({ message: "Could not load returns." });
  }
});

/**
 * SALES MANAGER: All return requests
 * GET /api/returns
 */
router.get("/", requireSalesManager, async (_req, res) => {
  try {
    const list = await ReturnRequest.find({})
      .populate("user", "name email")
      .populate("product", "name")
      .populate("order")
      .sort({ createdAt: -1 });

    return res.json(list);
  } catch (err) {
    console.error("GET ALL RETURNS ERROR:", err);
    return res.status(500).json({ message: "Could not load return requests." });
  }
});

/**
 * SALES MANAGER: Approve refund
 * PATCH /api/returns/:id/approve
 */
router.patch("/:id/approve", requireSalesManager, async (req, res) => {
  try {
    const returnId = req.params.id;

    const ret = await ReturnRequest.findById(returnId)
      .populate("user", "name email")
      .populate("product", "name")
      .populate("order");

    if (!ret) {
      return res.status(404).json({ message: "Return request not found." });
    }

    if (ret.status !== "Requested") {
      return res.status(400).json({
        message: `Return status must be Requested (current: ${ret.status}).`,
      });
    }

    const order = ret.order;
    if (!order) {
      return res.status(400).json({ message: "Order not found for this return." });
    }

    // Must be delivered
    const ship = String(order.shippingStatus || "").toLowerCase();
    if (ship !== "delivered") {
      return res.status(400).json({
        message: "Refund can only be approved if order is delivered.",
      });
    }

    // purchase-time price is order.items[].price (discount-applied)
    const orderItem = (order.items || []).find((it) => {
      const itemProdId = it.product || it.productId;
      const sameProd = String(itemProdId) === String(ret.product?._id || ret.product);
      const sameSize = !ret.size || String(it.size || "") === String(ret.size || "");
      return sameProd && sameSize;
    });

    if (!orderItem) {
      return res.status(400).json({
        message: "Matching order item not found for refund calculation.",
      });
    }

    const qty = Number(ret.quantity || 1);
    const refundedAmount = Number(orderItem.price || 0) * qty;

    // Update return record
    ret.status = "Approved";
    ret.refundedAmount = Math.round(refundedAmount * 100) / 100;
    ret.processedAt = new Date();
    await ret.save();

    // ✅ Update stock (now)  -> Kod2'nin doğru akışı
    if (ret.size) {
      await Product.updateOne(
        { _id: ret.product?._id || ret.product },
        { $inc: { [`sizes.${ret.size}`]: qty } }
      );
    }

    // Shipping history note
    order.shippingHistory = order.shippingHistory || [];
    order.shippingHistory.push({
      date: new Date(),
      status: `Refund approved (Return ${ret._id}) - ${ret.refundedAmount} TL`,
    });
    await order.save();

    // Email
    const to = ret.user?.email;
    if (to) {
      await sendRefundApprovalEmail({
        to,
        name: ret.user?.name || "Customer",
        returnId: String(ret._id),
        orderId: String(order._id),
        productName: ret.product?.name || "Product",
        quantity: qty,
        refundedAmount: ret.refundedAmount,
      });
    }

    return res.json({
      message: "Refund approved, stock updated, email sent.",
      returnRequest: ret,
    });
  } catch (err) {
    console.error("APPROVE REFUND ERROR:", err);
    return res.status(500).json({ message: "Server error: " + err.message });
  }
});

/**
 * SALES MANAGER: Reject return
 * PATCH /api/returns/:id/reject
 */
router.patch("/:id/reject", requireSalesManager, async (req, res) => {
  try {
    const returnId = req.params.id;
    const reason = String(req.body?.reason || "");

    const ret = await ReturnRequest.findById(returnId);
    if (!ret) {
      return res.status(404).json({ message: "Return request not found." });
    }

    if (ret.status !== "Requested") {
      return res.status(400).json({
        message: `Return status must be Requested (current: ${ret.status}).`,
      });
    }

    ret.status = "Rejected";
    ret.rejectReason = reason;
    ret.processedAt = new Date();
    await ret.save();

    return res.json({ message: "Return request rejected.", returnRequest: ret });
  } catch (err) {
    console.error("REJECT RETURN ERROR:", err);
    return res.status(500).json({ message: "Server error: " + err.message });
  }
});

export default router;
