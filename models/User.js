// backend/models/User.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    /* ================= BASIC ================= */
    name: { type: String, required: true, trim: true },

    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },

    password: { type: String, required: true },

    role: { type: String, enum: ["user", "admin"], default: "user" },

    /* ================= ACCOUNT STATUS (Freeze/Deactivate) ================= */
    isDeactivated: { type: Boolean, default: false },
    deactivatedAt: { type: Date, default: null },

    isFrozen: { type: Boolean, default: false },
    frozenAt: { type: Date, default: null },

    /* ================= EMAIL / PASSWORD FLOWS ================= */
    emailVerified: { type: Boolean, default: false },

    verificationToken: { type: String, default: null },

    resetPasswordToken: { type: String, default: null },
    resetPasswordExpires: { type: Date, default: null },

    /* ================= FAVORITES ================= */
    favorites: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Meal",
      },
    ],

    /* ================= BODY METRICS ================= */
    bodyMetrics: {
      height: { type: Number, default: null },
      weight: { type: Number, default: null },
      age: { type: Number, default: null },
      gender: { type: String, enum: ["male", "female"], default: null },
      activity: {
        type: String,
        enum: ["sedentary", "light", "moderate", "active", "very_active"],
        default: null,
      },
      goalWeight: { type: Number, default: null },
      locked: { type: Boolean, default: false },
    },

    /* ================= DAY PLANS ================= */
    dayPlans: [
      {
        date: { type: Date, required: true },
        items: [
          {
            meal: {
              type: mongoose.Schema.Types.ObjectId,
              ref: "Meal",
              required: true,
            },
            times: {
              type: [String],
              enum: ["breakfast", "lunch", "snack", "dinner"],
              required: true,
            },
          },
        ],
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
