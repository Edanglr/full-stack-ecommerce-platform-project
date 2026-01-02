import mongoose from "mongoose";

const discountCampaignSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },

    // Stored as 0..1 (0.20 = 20%).
    discountRate: { type: Number, required: true, min: 0, max: 1 },

    affectedProducts: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    ],

    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

discountCampaignSchema.methods.isCurrentlyActive = function () {
  if (!this.isActive) return false;
  const now = new Date();
  return now >= this.startDate && now <= this.endDate;
};

const DiscountCampaign = mongoose.model("DiscountCampaign", discountCampaignSchema);

export default DiscountCampaign;
