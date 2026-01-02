import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  name: { type: String, required: true },
  size: { type: String, default: "" },
  quantity: { type: Number, required: true },

  // Kept for backward compatibility with existing frontend payloads.
  price: { type: Number, required: true },

  imageUrl: { type: String, default: "" },

  // Snapshot fields keep reporting correct even if product price changes later.
  unitPriceAtPurchase: { type: Number, default: null },
  unitListPriceAtPurchase: { type: Number, default: null },
  discountRateAtPurchase: { type: Number, default: 0 }, // 0..1
  unitCostAtPurchase: { type: Number, default: null },

  discountCampaignId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "DiscountCampaign",
    default: null,
  },
});

const shippingHistorySchema = new mongoose.Schema({
  status: { type: String, required: true },
  date: { type: Date, default: Date.now },
});

const orderSchema = new mongoose.Schema(
  {
    items: {
      type: [orderItemSchema],
      required: true,
    },

    // Kept for backward compatibility.
    totalAmount: {
      type: Number,
      required: true,
    },

    // Order-level snapshots for revenue/profit and invoice rendering.
    subtotalAtPurchase: { type: Number, default: null },
    discountTotalAtPurchase: { type: Number, default: 0 },
    totalAtPurchase: { type: Number, default: null },
    profitAtPurchase: { type: Number, default: null },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    trackingCode: {
      type: String,
      unique: true,
    },

    shippingStatus: {
      type: String,
      default: "Processing",
    },

    shippingHistory: {
      type: [shippingHistorySchema],
      default: [],
    },

    deliveryAddress: {
      type: String,
      default: "",
    },

    isCompleted: {
      type: Boolean,
      default: false,
    },

    // These are used in routes; keeping them in schema prevents data loss.
    paymentStatus: { type: String, default: "" },
    paymentDetails: {
      transactionId: { type: String, default: "" },
      authCode: { type: String, default: "" },
    },
    invoiceNumber: { type: String, default: "" },
    invoicePdfPath: { type: String, default: "" },
  },
  { timestamps: true }
);

const Order = mongoose.model("Order", orderSchema);

export default Order;
