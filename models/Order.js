// backend/models/Order.js (BACKEND)
const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    items: [
      {
        meal: { type: mongoose.Schema.Types.ObjectId, ref: "Meal", required: true },
        title: String,
        price: Number,
        protein: Number,
        calories: Number,
        qty: { type: Number, default: 1 },
      },
    ],

    totals: {
      subtotal: { type: Number, required: true },
      discount: { type: Number, default: 0 },
      payable: { type: Number, required: true },
      totalProtein: { type: Number, default: 0 },
      totalCalories: { type: Number, default: 0 },
    },

    coupon: {
      code: String,
      discount: Number,

      // ✅ needed for your checkout.js (redeem only once after payment)
      redeemed: { type: Boolean, default: false },
    },

    delivery: {
      address: {
        fullName: String,
        phone: String,
        line1: String,
        line2: String,
        city: String,
        state: String,
        pincode: String,

        // ✅ NEW: Google Maps location support
        locationMode: { type: String, enum: ["manual", "current"], default: "manual" },
        locationText: { type: String, default: "" }, // manual text/link
        lat: { type: Number, default: null },
        lng: { type: Number, default: null },
        mapsUrl: { type: String, default: "" }, // auto url for current
      },
      slot: {
        date: String, // "YYYY-MM-DD"
        time: String, // backend expects "HH:00"
      },
    },

    payment: {
      provider: { type: String, default: "razorpay" },
      status: { type: String, enum: ["created", "paid", "failed"], default: "created" },

      razorpayOrderId: String,
      razorpayPaymentId: String,
      razorpaySignature: String,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
