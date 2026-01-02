// backend/src/routes/orderRoutes.js
import express from "express";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import User from "../models/User.js";

import { generateTrackingCode } from "../utils/trackingCode.js";
import { requireAuth, requireManager, requireRole } from "../middleware/auth.js";
import { mockBankCharge } from "../utils/mockBank.js";
import { generateInvoicePdf } from "../utils/invoice.js";
import { sendInvoiceEmail } from "../utils/email.js";

const router = express.Router();

// 1) Yeni Sipariş Oluşturma
router.post("/", requireAuth, async (req, res) => {
  try {
    const { items, deliveryAddress } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "No items provided in the order." });
    }

    // Stok kontrolü
    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product) return res.status(404).json({ message: `Product not found: ${item.productId}` });
      if (!item.size) return res.status(400).json({ message: `Size is required for product ${product.name}` });

      const sizeKey = item.size;
      const sizes = product.sizes || {};
      const currentStock = sizes[sizeKey] ?? 0;

      if (currentStock < item.quantity) {
        return res.status(400).json({
          message: `Not enough stock for ${product.name} (size ${sizeKey}). Available: ${currentStock}`,
        });
      }
    }

    // Stok düşme
    for (const item of items) {
      const sizeKey = item.size;
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { [`sizes.${sizeKey}`]: -item.quantity },
      });
    }

    const totalAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    // Mock bankadan ödeme al
    const paymentResult = await mockBankCharge({ amount: totalAmount, user: req.user });
    if (!paymentResult || !paymentResult.success) {
      return res.status(402).json({ message: "Payment failed. Please try again." });
    }

    const trackingCode = generateTrackingCode();

    const newOrder = await Order.create({
      user: req.user.id,
      items,
      totalAmount,
      trackingCode,
      shippingStatus: "Processing",
      shippingHistory: [{ status: "Order received", date: new Date() }],
      paymentStatus: "Paid",
      paymentDetails: { transactionId: paymentResult.transactionId || "", authCode: paymentResult.authCode || "" },
      deliveryAddress: deliveryAddress || "",
      isCompleted: false,
    });

    const user = await User.findById(req.user.id).lean();
    if (user) {
      try {
        const { invoiceNumber, pdfPath } = await generateInvoicePdf({ order: newOrder, user });
        newOrder.invoiceNumber = invoiceNumber;
        newOrder.invoicePdfPath = pdfPath;
        await newOrder.save();
        if (user.email) await sendInvoiceEmail({ to: user.email, pdfPath });
      } catch (invoiceErr) {
        console.error("INVOICE ERROR:", invoiceErr);
      }
    }

    return res.status(201).json({
      message: "Order created and paid successfully.",
      orderId: newOrder._id,
      trackingCode: newOrder.trackingCode,
      invoice: {
        invoiceNumber: newOrder.invoiceNumber || "",
        totalAmount: newOrder.totalAmount,
        createdAt: newOrder.createdAt,
        items: newOrder.items,
        trackingCode: newOrder.trackingCode,
        shippingAddress: {
          name: user?.name || "Customer",
          address: user?.address || newOrder.deliveryAddress || "",
          city: user?.city || "",
          postalCode: user?.postalCode || user?.zip || "",
        },
      },
    });
  } catch (err) {
    console.error("ORDER ERROR:", err);
    return res.status(500).json({ message: "Server error while creating order." });
  }
});

// 2) Kullanıcının Kendi Siparişlerini Çekmesi
router.get("/my", requireAuth, async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user.id })
      .populate({ path: "items.productId", select: "name imageUrl image price" })
      .sort({ createdAt: -1 })
      .lean();

    const formatted = orders.map((order) => ({
      _id: order._id,
      orderCode: order._id.toString().slice(-6).toUpperCase(),
      trackingCode: order.trackingCode || "N/A", 
      shippingStatus: order.shippingStatus || "Processing",
      totalAmount: order.totalAmount, 
      createdAt: order.createdAt,
      shippingHistory: order.shippingHistory || [],
      items: order.items.map((i) => ({
        name: i.productId?.name || i.name || "Product",
        productId: i.productId?._id || i.productId,
        imageUrl: i.productId?.imageUrl || i.productId?.image || i.imageUrl || "https://via.placeholder.com/80?text=No+Image",
        price: i.price,
        quantity: i.quantity,
        size: i.size,
      })),
    }));

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ message: "Order fetch error." });
  }
});

// 3) Sipariş İptali (Kullanıcı Tarafı - Full Order)
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found." });

    if (order.user.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized to cancel this order." });
    }

    if (order.shippingStatus !== "Processing") {
      return res.status(400).json({ message: `Cannot cancel order in ${order.shippingStatus} status.` });
    }

    // Stokları geri yükle
    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { [`sizes.${item.size}`]: item.quantity },
      });
    }

    // Siparişi silmek yerine durumunu Cancelled yapıyoruz (Kaydı korumak için tavsiye edilir)
    order.shippingStatus = "Cancelled";
    order.shippingHistory.push({ status: "Order cancelled by customer", date: new Date() });
    await order.save();

    return res.json({ message: "Order cancelled successfully. Stock has been restored." });
  } catch (err) {
    return res.status(500).json({ message: "Error while cancelling order." });
  }
});

// 4) Siparişten Ürün İptali (Support/Admin Tarafı)
router.post("/:orderId/cancel-item", requireRole("supportAgent", "productManager"), async (req, res) => {
  try {
    const { orderId } = req.params;
    const { productId, size } = req.body;

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found." });

    const itemIndex = order.items.findIndex((it) => {
      const itemProdId = it.productId._id ? it.productId._id.toString() : it.productId.toString();
      const targetSize = size === "-" ? "" : (size || "");
      const itemSize = it.size === "-" ? "" : (it.size || "");
      return itemProdId === productId.toString() && itemSize === targetSize;
    });

    if (itemIndex === -1) return res.status(404).json({ message: "Item not found." });

    const cancelledItem = order.items[itemIndex];

    // Stok geri yükle
    await Product.findByIdAndUpdate(cancelledItem.productId, {
      $inc: { [`sizes.${cancelledItem.size || ""}`]: cancelledItem.quantity }
    });

    // Fiyatı düş ve ürünü çıkar
    order.totalAmount = Math.max(0, order.totalAmount - (cancelledItem.price * cancelledItem.quantity));
    order.items.splice(itemIndex, 1);
    
    order.shippingHistory.push({
      status: `Item cancelled: ${cancelledItem.name}`,
      date: new Date()
    });

    // Eğer ürün kalmadıysa veya kritik bir iptalse durumu güncelliyoruz
    if (order.items.length === 0) {
      order.shippingStatus = "Cancelled";
    } else {
      // Ürün iptal edildiğinde ana durumun "Cancelled" gözükmesini istiyorsanız:
      order.shippingStatus = "Cancelled"; 
    }

    await order.save();
    res.json({ message: "Item successfully cancelled.", order });
  } catch (err) {
    res.status(500).json({ message: "Internal server error." });
  }
});

// 5) Sipariş Durumu Güncelleme (Admin)
router.put("/:id/status", requireRole("productManager"), async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ["Processing", "In-transit", "Delivered", "Cancelled"];

    if (!allowed.includes(status)) return res.status(400).json({ message: "Invalid status." });

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found." });

    order.shippingStatus = status;
    order.shippingHistory.push({ status, date: new Date() });
    order.isCompleted = status === "Delivered";

    await order.save();
    return res.json({ message: "Order status updated.", order });
  } catch (err) {
    return res.status(500).json({ message: "Error while updating status." });
  }
});

// 6) Kargo Takibi
router.get("/track/:trackingCode", async (req, res) => {
  try {
    const order = await Order.findOne({ trackingCode: req.params.trackingCode });
    if (!order) return res.status(404).json({ message: "Tracking code not found." });

    return res.json({
      trackingCode: order.trackingCode,
      shippingStatus: order.shippingStatus,
      shippingHistory: order.shippingHistory,
      items: order.items,
      totalAmount: order.totalAmount,
      createdAt: order.createdAt,
    });
  } catch (err) {
    return res.status(500).json({ message: "Tracking error." });
  }
});

// 7) Admin Delivery Görünümü
router.get("/admin/deliveries", requireRole("productManager"), async (_req, res) => {
  try {
    const orders = await Order.find({}).populate("user", "name email").lean().sort({ createdAt: -1 });

    const deliveryList = orders.flatMap((order) =>
      order.items.map((item) => ({
        deliveryId: order._id,
        customerName: order.user?.name || order.user?.email || "Unknown",
        productName: item.name,
        quantity: item.quantity,
        totalPrice: item.price * item.quantity,
        deliveryAddress: order.deliveryAddress || "Not specified",
        shippingStatus: order.shippingStatus,
        trackingCode: order.trackingCode,
        createdAt: order.createdAt,
      }))
    );
    return res.json(deliveryList);
  } catch (err) {
    return res.status(500).json({ message: "Error fetching deliveries." });
  }
});

export default router;
