const express = require("express");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const Order = require("../models/Order");
const Coupon = require("../models/Coupon");
const { verifyAuth } = require("../middleware/auth");

const router = express.Router();

/* ================= RAZORPAY ================= */

const razorpay =
  process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET
    ? new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
      })
    : null;

/* ================= HELPERS ================= */

const computeTotals = (items) => {
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const totalProtein = items.reduce(
    (s, i) => s + (i.protein || 0) * i.qty,
    0
  );
  const totalCalories = items.reduce(
    (s, i) => s + (i.calories || 0) * i.qty,
    0
  );

  return {
    subtotal: Math.round(subtotal),
    totalProtein: Math.round(totalProtein),
    totalCalories: Math.round(totalCalories),
  };
};

const applyCoupon = (subtotal, coupon) => {
  if (!coupon || !coupon.isActive) {
    return { discount: 0, payable: subtotal };
  }

  if (coupon.expiry && new Date(coupon.expiry) < new Date()) {
    return { discount: 0, payable: subtotal };
  }

  if (subtotal < coupon.minCartValue) {
    return { discount: 0, payable: subtotal };
  }

  let discount =
    coupon.type === "percent"
      ? (coupon.value / 100) * subtotal
      : coupon.value;

  discount = Math.min(discount, coupon.maxDiscount || discount, subtotal);

  return {
    discount: Math.round(discount),
    payable: Math.round(subtotal - discount),
  };
};

/* =====================================================
   CREATE ORDER
   POST /api/checkout/create-order
===================================================== */
router.post("/create-order", verifyAuth, async (req, res) => {
  try {
    if (!razorpay) {
      return res.status(500).json({ message: "Payment service unavailable" });
    }

    const { items, address, deliverySlot, couponCode } = req.body;

    if (!items || !items.length) {
      return res.status(400).json({ message: "Cart is empty" });
    }

    if (
      !address?.fullName ||
      !address?.phone ||
      !address?.line1 ||
      !address?.city ||
      !address?.state ||
      !address?.pincode
    ) {
      return res.status(400).json({ message: "Address is incomplete" });
    }

    if (!deliverySlot?.date || !deliverySlot?.time) {
      return res.status(400).json({ message: "Delivery slot missing" });
    }

    /* ✅ NORMALIZE ITEMS (MATCH ORDER SCHEMA) */
    const normalizedItems = items.map((i) => {
      if (!i.mealId) {
        throw new Error("Meal ID missing in cart item");
      }

      return {
        meal: i.mealId,
        title: i.title,
        price: i.price,
        protein: i.protein || 0,
        calories: i.calories || 0,
        qty: i.qty,
      };
    });

    const { subtotal, totalProtein, totalCalories } =
      computeTotals(normalizedItems);

    let coupon = null;
    if (couponCode) {
      coupon = await Coupon.findOne({
        code: couponCode.toUpperCase(),
        isActive: true,
      });
    }

    const { discount, payable } = applyCoupon(subtotal, coupon);

    /* ---- Razorpay Order ---- */
    const rzpOrder = await razorpay.orders.create({
      amount: payable * 100, // paise
      currency: "INR",
      receipt: `rcpt_${Date.now()}`,
    });

    /* ---- Save Order in DB ---- */
    const order = await Order.create({
      user: req.user._id,

      items: normalizedItems,

      totals: {
        subtotal,
        discount,
        payable,
        totalProtein,
        totalCalories,
      },

      coupon: coupon
        ? {
            code: coupon.code,
            discount,
          }
        : undefined,

      delivery: {
        address,
        slot: deliverySlot,
      },

      payment: {
        provider: "razorpay",
        status: "created",
        razorpayOrderId: rzpOrder.id,
      },
    });

    res.json({
      keyId: process.env.RAZORPAY_KEY_ID,
      razorpayOrderId: rzpOrder.id,
      amount: payable * 100,
      currency: "INR",
      orderId: order._id,
    });
  } catch (err) {
    console.error("❌ CREATE ORDER ERROR:", err.message);
    res.status(500).json({ message: "Failed to create order" });
  }
});

/* =====================================================
   VERIFY PAYMENT
   POST /api/checkout/verify
===================================================== */
router.post("/verify", verifyAuth, async (req, res) => {
  try {
    const {
      orderId,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    const body = `${razorpay_order_id}|${razorpay_payment_id}`;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      order.payment.status = "failed";
      await order.save();
      return res.status(400).json({ message: "Payment verification failed" });
    }

    order.payment.status = "paid";
    order.payment.razorpayPaymentId = razorpay_payment_id;
    order.payment.razorpaySignature = razorpay_signature;
    await order.save();

    res.json({ message: "Payment verified successfully", order });
  } catch (err) {
    console.error("❌ VERIFY ERROR:", err.message);
    res.status(500).json({ message: "Verification failed" });
  }
});

module.exports = router;
