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
      },
      slot: {
        date: String, // "YYYY-MM-DD"
        time: String, // "7:00 AM - 9:00 AM"
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
