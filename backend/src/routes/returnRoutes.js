// backend/src/routes/returnRoutes.js
import express from "express";
import ReturnRequest from "../models/returnModel.js";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import { requireAuth, requireSalesManager } from "../middleware/auth.js";
import { sendRefundApprovalEmail } from "../utils/email.js";

const router = express.Router();

function pushReturnHistory(ret, status, note, byUserId) {
  ret.statusHistory = ret.statusHistory || [];
  ret.statusHistory.push({
    status,
    note: note || "",
    by: byUserId || null,
    at: new Date(),
  });
}

function pushOrderHistory(order, statusText) {
  order.shippingHistory = order.shippingHistory || [];
  order.shippingHistory.push({
    date: new Date(),
    status: statusText,
  });
}

function isWithinReturnWindow(orderCreatedAt, days) {
  if (!orderCreatedAt) return false;
  const created = new Date(orderCreatedAt);
  if (Number.isNaN(created.getTime())) return false;
  const now = new Date();
  const diffMs = now.getTime() - created.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays <= Number(days);
}

/*
CUSTOMER
POST /api/returns
*/
router.post("/", requireAuth, async (req, res) => {
  try {
    const { orderId, productId, size, quantity, reason } = req.body;

    if (!orderId || !productId || !reason) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    const userId = req.user.id || req.user._id;

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found." });

    if (order.user?.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Not authorized." });
    }

    const ship = String(order.shippingStatus || "").toLowerCase();
    if (ship !== "delivered") {
      return res
        .status(400)
        .json({ message: "You can only return delivered orders." });
    }

    // 30 day window from purchase time (order.createdAt)
    if (!isWithinReturnWindow(order.createdAt, 30)) {
      return res.status(400).json({
        message:
          "Return window expired. You can only request a return within 30 days of purchase.",
      });
    }

    const orderItem = (order.items || []).find((it) => {
      const itemProdId = it.product || it.productId;
      const sameProd = String(itemProdId) === String(productId);
      const sameSize =
        !size || String(it.size || "") === String(size || "");
      return sameProd && sameSize;
    });

    if (!orderItem) {
      return res
        .status(400)
        .json({ message: "This product is not part of the order." });
    }

    const finalSize = (size || orderItem.size || "").toString();
    const finalQty = Number(quantity || orderItem.quantity || 1);

    if (!finalSize)
      return res.status(400).json({ message: "Size is required for return." });
    if (!finalQty || finalQty <= 0)
      return res.status(400).json({ message: "Invalid quantity." });

    const existingReturn = await ReturnRequest.findOne({
      order: orderId,
      product: productId,
      size: finalSize,
      status: { $ne: "Cancelled" },
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
      requestedAt: new Date(),
      statusHistory: [
        {
          status: "Requested",
          note: reason,
          by: userId,
          at: new Date(),
        },
      ],
    });

    pushOrderHistory(order, `Return requested: ${reason}`);
    await order.save();

    return res.status(201).json(returnRequest);
  } catch (err) {
    console.error("RETURN REQUEST ERROR:", err);
    return res.status(500).json({ message: "Server error: " + err.message });
  }
});

/*
CUSTOMER
GET /api/returns/my
*/
router.get("/my", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;

    const returns = await ReturnRequest.find({ user: userId })
      .populate("product", "name imageUrl image price")
      .populate("order", "_id trackingCode shippingStatus")
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

/*
SALES MANAGER
GET /api/returns?status=Requested
*/
router.get("/", requireSalesManager, async (req, res) => {
  try {
    const status = req.query?.status ? String(req.query.status) : null;
    const filter = {};
    if (status) filter.status = status;

    const list = await ReturnRequest.find(filter)
      .populate("user", "name email")
      .populate("product", "name")
      .populate("order")
      .sort({ createdAt: -1 });

    return res.json(list);
  } catch (err) {
    console.error("GET ALL RETURNS ERROR:", err);
    return res
      .status(500)
      .json({ message: "Could not load return requests." });
  }
});

/*
SALES MANAGER
PATCH /api/returns/:id/approve
Requested -> Approved
✅ stock restore burada (senin requirement’a göre)
*/
router.patch("/:id/approve", requireSalesManager, async (req, res) => {
  try {
    const returnId = req.params.id;
    const managerId = req.user?.id || req.user?._id || null;

    const ret = await ReturnRequest.findById(returnId)
      .populate("user", "name email")
      .populate("product", "name")
      .populate("order");

    if (!ret)
      return res.status(404).json({ message: "Return request not found." });

    if (ret.status !== "Requested") {
      return res.status(400).json({
        message: `Return status must be Requested (current: ${ret.status}).`,
      });
    }

    const order = ret.order;
    if (!order)
      return res.status(400).json({ message: "Order not found for this return." });

    const ship = String(order.shippingStatus || "").toLowerCase();
    if (ship !== "delivered") {
      return res.status(400).json({
        message: "Refund can only be approved if order is delivered.",
      });
    }

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

    const unitPriceAtPurchase = Number(
      orderItem.unitPriceAtPurchase ?? orderItem.price ?? 0
    );
    const refundedAmount = unitPriceAtPurchase * qty;

    ret.status = "Approved";
    ret.refundedAmount = Math.round(refundedAmount * 100) / 100;
    ret.approvedAt = new Date();
    ret.processedAt = new Date();

    pushReturnHistory(ret, "Approved", "Approved by sales manager", managerId);
    await ret.save();

    // ✅ Stock restore (sizes map)
    if (ret.size) {
      await Product.updateOne(
        { _id: ret.product?._id || ret.product },
        { $inc: { [`sizes.${ret.size}`]: qty } }
      );
    }

    pushOrderHistory(order, `Return approved (Return ${ret._id})`);
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
      } catch (mailErr) {
        console.error("REFUND APPROVAL EMAIL ERROR:", mailErr);
      }
    }

    return res.json({ message: "Refund approved.", returnRequest: ret });
  } catch (err) {
    console.error("APPROVE REFUND ERROR:", err);
    return res.status(500).json({ message: "Server error: " + err.message });
  }
});

/*
SALES MANAGER
PATCH /api/returns/:id/reject
Requested -> Rejected
*/
router.patch("/:id/reject", requireSalesManager, async (req, res) => {
  try {
    const returnId = req.params.id;
    const managerId = req.user?.id || req.user?._id || null;
    const reason = String(req.body?.reason || "");

    const ret = await ReturnRequest.findById(returnId);
    if (!ret)
      return res.status(404).json({ message: "Return request not found." });

    if (ret.status !== "Requested") {
      return res.status(400).json({
        message: `Return status must be Requested (current: ${ret.status}).`,
      });
    }

    ret.status = "Rejected";
    ret.rejectReason = reason;
    ret.rejectedAt = new Date();
    ret.processedAt = new Date();

    pushReturnHistory(
      ret,
      "Rejected",
      reason ? `Rejected: ${reason}` : "Rejected by sales manager",
      managerId
    );
    await ret.save();

    return res.json({ message: "Return request rejected.", returnRequest: ret });
  } catch (err) {
    console.error("REJECT RETURN ERROR:", err);
    return res.status(500).json({ message: "Server error: " + err.message });
  }
});

/*
SALES MANAGER
PATCH /api/returns/:id/received
Approved -> Received
*/
router.patch("/:id/received", requireSalesManager, async (req, res) => {
  try {
    const managerId = req.user?.id || req.user?._id || null;

    const ret = await ReturnRequest.findById(req.params.id)
      .populate("order")
      .populate("product", "name");
    if (!ret)
      return res.status(404).json({ message: "Return request not found." });

    if (ret.status !== "Approved") {
      return res.status(400).json({
        message: `Return status must be Approved (current: ${ret.status}).`,
      });
    }

    ret.status = "Received";
    ret.receivedAt = new Date();
    ret.processedAt = new Date();

    pushReturnHistory(ret, "Received", "Item received by warehouse", managerId);
    await ret.save();

    if (ret.order) {
      pushOrderHistory(ret.order, `Return received (Return ${ret._id})`);
      await ret.order.save();
    }

    return res.json({ message: "Return marked as received.", returnRequest: ret });
  } catch (err) {
    console.error("RECEIVED RETURN ERROR:", err);
    return res.status(500).json({ message: "Server error: " + err.message });
  }
});

/*
SALES MANAGER
PATCH /api/returns/:id/refund
Received -> Refunded
⚠️ burada stock restore YOK (zaten approve'da yaptık)
*/
router.patch("/:id/refund", requireSalesManager, async (req, res) => {
  try {
    const managerId = req.user?.id || req.user?._id || null;

    const ret = await ReturnRequest.findById(req.params.id)
      .populate("order")
      .populate("product", "name");
    if (!ret)
      return res.status(404).json({ message: "Return request not found." });

    if (ret.status !== "Received") {
      return res.status(400).json({
        message: `Return status must be Received (current: ${ret.status}).`,
      });
    }

    // optional manual override
    const overrideAmount =
      req.body?.refundedAmount != null && String(req.body.refundedAmount).trim() !== ""
        ? Number(req.body.refundedAmount)
        : null;

    if (overrideAmount != null && !(overrideAmount > 0)) {
      return res.status(400).json({ message: "Invalid refundedAmount." });
    }

    if (overrideAmount != null) {
      ret.refundedAmount = Math.round(overrideAmount * 100) / 100;
    }

    ret.status = "Refunded";
    ret.refundedAt = new Date();
    ret.processedAt = new Date();

    pushReturnHistory(ret, "Refunded", "Refund processed", managerId);
    await ret.save();

    if (ret.order) {
      pushOrderHistory(
        ret.order,
        `Refunded (Return ${ret._id}) ${ret.refundedAmount ?? ""} TL`
      );
      await ret.order.save();
    }

    return res.json({ message: "Return marked as refunded.", returnRequest: ret });
  } catch (err) {
    console.error("REFUND RETURN ERROR:", err);
    return res.status(500).json({ message: "Server error: " + err.message });
  }
});

/*
SALES MANAGER
PATCH /api/returns/:id/complete
Refunded -> Completed
*/
router.patch("/:id/complete", requireSalesManager, async (req, res) => {
  try {
    const managerId = req.user?.id || req.user?._id || null;

    const ret = await ReturnRequest.findById(req.params.id)
      .populate("order")
      .populate("product", "name");
    if (!ret)
      return res.status(404).json({ message: "Return request not found." });

    if (ret.status !== "Refunded") {
      return res.status(400).json({
        message: `Return status must be Refunded (current: ${ret.status}).`,
      });
    }

    ret.status = "Completed";
    ret.completedAt = new Date();
    ret.processedAt = new Date();

    pushReturnHistory(ret, "Completed", "Return flow completed", managerId);
    await ret.save();

    if (ret.order) {
      pushOrderHistory(ret.order, `Return completed (Return ${ret._id})`);
      await ret.order.save();
    }

    return res.json({ message: "Return marked as completed.", returnRequest: ret });
  } catch (err) {
    console.error("COMPLETE RETURN ERROR:", err);
    return res.status(500).json({ message: "Server error: " + err.message });
  }
});

export default router;
