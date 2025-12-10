import mongoose from "mongoose";

const paymentMethodSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    cardNumberMasked: { type: String, required: true }, // **** **** **** 1234
    last4: { type: String, required: true },
    expiry: { type: String, required: true },
  },
  { timestamps: true }
);

export default mongoose.models.PaymentMethod || mongoose.model("PaymentMethod", paymentMethodSchema);

