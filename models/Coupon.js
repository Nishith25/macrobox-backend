const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },

    type: { type: String, enum: ["flat", "percent"], required: true },
    value: { type: Number, required: true }, // flat ₹ or percent %

    minCartTotal: { type: Number, default: 0 },
    maxDiscount: { type: Number, default: 0 }, // only for percent (0 = no cap)

    expiresAt: { type: Date, required: true },

    isActive: { type: Boolean, default: true },

    usageLimitTotal: { type: Number, default: 0 }, // 0 = unlimited
    usageLimitPerUser: { type: Number, default: 1 },

    usedCount: { type: Number, default: 0 },

    usedBy: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        count: { type: Number, default: 0 },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Coupon", couponSchema);
