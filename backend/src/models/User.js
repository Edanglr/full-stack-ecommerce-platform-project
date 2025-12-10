// backend/src/models/User.js
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    passwordHash: {
      type: String,
      required: true,
    },

    // customer / manager
    role: {
      type: String,
      enum: ["customer", "manager"],
      default: "customer",
    },

    // ⭐ ZARA tarzı profil alanları
    phone: {
      type: String,
      default: "",
      trim: true,
    },

    address: {
      type: String,
      default: "",
      trim: true,
    },

    city: {
      type: String,
      default: "",
      trim: true,
    },

    postalCode: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);
export default User;
