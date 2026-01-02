import express from "express";
import ReturnRequest from "../models/returnModel.js";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import { requireAuth, requireSalesManager } from "../middleware/auth.js";
import { sendRefundApprovalEmail } from "../utils/email.js";

const router = express.Router();

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

function pushReturnHistory(ret, status, note, byUserId) {
  ret.statusHistory = ret.statusHistory || [];
  ret.statusHistory.push({
    status,
    note: note || "",
    by: byUserId || null,
    at: new Date(),
  });
}

function matchOrderItem(order, productId, size) {
  const items = order?.items || [];
  return items.find((it) => {
    const itemProdId = it.product || it.productId;
    const sameProd = String(itemProdId) === String(productId);
    const sameSize = !size || String(it.size || "") === String(size || "");
    return sameProd && sameSize;
  });
}

/**
 * CUSTOMER: Create return request
 * POST /api/returns
 */
router.post("/", requireAuth, async (req, res) => {
  try {
    const { orderId, productId, size, quantity, reason } = req.body;

    if (!orderId || !productId || !reason) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    const userId = req.user.id || req.user._id;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    if (order.user?.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Not authorized." });
    }

    const ship = String(order.shippingStatus || "").toLowerCase();
    if (ship !== "delivered") {
      return res.status(400).json({ message: "You can only return delivered orders." });
    }

    const orderItem = matchOrderItem(order, productId, size);
    if (!orderItem) {
      return res.status(400).json({ message: "This product is not part of the order." });
    }

    const finalSize = (size || orderItem.size || "").toString();
    const finalQty = Number(quantity || orderItem.quantity || 1);

    if (!finalSize) {
      return res.status(400).json({ message: "Size is required for return." });
    }
    if (!finalQty || finalQty <= 0) {
      return res.status(400).json({ message: "Invalid quantity." });
    }

    const existingReturn = await ReturnRequest.findOne({
      order: orderId,
      product: productId,
      size: finalSize,
    });

    if (existingReturn) {
      return res.status(400).json({ message: "Return request already created for this item." });
    }

    const returnRequest = await ReturnRequest.create({
      user: userId,
      order: orderId,
      product: productId,
      size: finalSize,
      quantity: finalQty,
      reason,
      status: "Requested",
      requestedAt: new Date(),
      statusHistory: [
        {
          status: "Requested",
          note: "Request created",
          by: userId,
          at: new Date(),
        },
      ],
    });

    order.shippingHistory = order.shippingHistory || [];
    order.shippingHistory.push({
      date: new Date(),
      status: `Return requested: ${reason}`,
    });
    await order.save();

    return res.status(201).json(returnRequest);
  } catch (err) {
    console.error("RETURN REQUEST ERROR:", err);
    return res.status(500).json({ message: "Server error: " + err.message });
  }
});

/**
 * CUSTOMER: My returns
 * GET /api/returns/my
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
 * SALES MANAGER: Approve return
 * PATCH /api/returns/:id/approve
 */
router.patch("/:id/approve", requireSalesManager, async (req, res) => {
  try {
    const returnId = req.params.id;
    const managerId = req.user?.id || req.user?._id || null;

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

    const ship = String(order.shippingStatus || "").toLowerCase();
    if (ship !== "delivered") {
      return res.status(400).json({
        message: "Refund can only be approved if order is delivered.",
      });
    }

    const orderItem = matchOrderItem(order, ret.product?._id || ret.product, ret.size);
    if (!orderItem) {
      return res.status(400).json({
        message: "Matching order item not found for refund calculation.",
      });
    }

    const qty = Number(ret.quantity || 1);

    const unitSale =
      orderItem.unitPriceAtPurchase != null
        ? Number(orderItem.unitPriceAtPurchase)
        : Number(orderItem.price || 0);

    const refundedAmount = round2(unitSale * qty);

    ret.status = "Approved";
    ret.refundedAmount = refundedAmount;
    ret.processedAt = new Date();
    ret.approvedAt = new Date();

    pushReturnHistory(ret, "Approved", "Approved by sales manager", managerId);

    await ret.save();

    if (ret.size) {
      await Product.updateOne(
        { _id: ret.product?._id || ret.product },
        { $inc: { [`sizes.${ret.size}`]: qty } }
      );
    }

    order.shippingHistory = order.shippingHistory || [];
    order.shippingHistory.push({
      date: new Date(),
      status: `Return approved (Return ${ret._id}) - ${ret.refundedAmount} TL`,
    });
    await order.save();

    const to = ret.user?.email;
    if (to) {
      try {
        await sendRefundApprovalEmail({
          to,
          name: ret.user?.name || "Customer",
          returnId: String(ret._id),
          orderId: String(order._id),
          productName: ret.product?.name || "Product",
          quantity: qty,
          refundedAmount: ret.refundedAmount,
        });
      } catch (emailErr) {
        console.error("REFUND EMAIL ERROR:", emailErr);
      }
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
    const managerId = req.user?.id || req.user?._id || null;

    const reason = String(req.body?.reason || "").trim();

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
    ret.rejectedAt = new Date();

    pushReturnHistory(ret, "Rejected", reason ? `Rejected: ${reason}` : "Rejected", managerId);

    await ret.save();

    return res.json({ message: "Return request rejected.", returnRequest: ret });
  } catch (err) {
    console.error("REJECT RETURN ERROR:", err);
    return res.status(500).json({ message: "Server error: " + err.message });
  }
});

/**
 * SALES MANAGER: Mark received
 * PATCH /api/returns/:id/received
 */
router.patch("/:id/received", requireSalesManager, async (req, res) => {
  try {
    const managerId = req.user?.id || req.user?._id || null;

    const ret = await ReturnRequest.findById(req.params.id);
    if (!ret) return res.status(404).json({ message: "Return request not found." });

    if (ret.status !== "Approved") {
      return res.status(400).json({ message: `Return must be Approved (current: ${ret.status}).` });
    }

    ret.status = "Received";
    ret.receivedAt = new Date();
    pushReturnHistory(ret, "Received", "Item received", managerId);

    await ret.save();
    return res.json({ message: "Return marked as received.", returnRequest: ret });
  } catch (err) {
    console.error("RECEIVED RETURN ERROR:", err);
    return res.status(500).json({ message: "Server error: " + err.message });
  }
});

/**
 * SALES MANAGER: Finalize refund
 * PATCH /api/returns/:id/refund
 * Body: { refundedAmount? }
 */
router.patch("/:id/refund", requireSalesManager, async (req, res) => {
  try {
    const managerId = req.user?.id || req.user?._id || null;

    const ret = await ReturnRequest.findById(req.params.id);
    if (!ret) return res.status(404).json({ message: "Return request not found." });

    if (!(ret.status === "Approved" || ret.status === "Received")) {
      return res.status(400).json({ message: `Return must be Approved/Received (current: ${ret.status}).` });
    }

    const override = req.body?.refundedAmount;
    if (override != null) {
      const n = Number(override);
      if (!(n >= 0)) return res.status(400).json({ message: "refundedAmount must be a valid number." });
      ret.refundedAmount = round2(n);
    }

    ret.status = "Refunded";
    ret.refundedAt = new Date();
    ret.processedAt = new Date();

    pushReturnHistory(ret, "Refunded", "Refund processed", managerId);

    await ret.save();
    return res.json({ message: "Refund marked as processed.", returnRequest: ret });
  } catch (err) {
    console.error("REFUND RETURN ERROR:", err);
    return res.status(500).json({ message: "Server error: " + err.message });
  }
});

/**
 * SALES MANAGER: Complete return
 * PATCH /api/returns/:id/complete
 */
router.patch("/:id/complete", requireSalesManager, async (req, res) => {
  try {
    const managerId = req.user?.id || req.user?._id || null;

    const ret = await ReturnRequest.findById(req.params.id);
    if (!ret) return res.status(404).json({ message: "Return request not found." });

    if (!(ret.status === "Refunded" || ret.status === "Received" || ret.status === "Approved")) {
      return res.status(400).json({ message: `Cannot complete (current: ${ret.status}).` });
    }

    ret.status = "Completed";
    ret.completedAt = new Date();

    pushReturnHistory(ret, "Completed", "Return completed", managerId);

    await ret.save();
    return res.json({ message: "Return completed.", returnRequest: ret });
  } catch (err) {
    console.error("COMPLETE RETURN ERROR:", err);
    return res.status(500).json({ message: "Server error: " + err.message });
  }
});

export default router;
