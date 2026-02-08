// backend/routes/checkout.js
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
  const totalProtein = items.reduce((s, i) => s + (i.protein || 0) * i.qty, 0);
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
  if (!coupon || !coupon.isActive) return { discount: 0, payable: subtotal };

  if (coupon.expiry && new Date(coupon.expiry) < new Date())
    return { discount: 0, payable: subtotal };

  if (coupon.minCartValue && subtotal < coupon.minCartValue)
    return { discount: 0, payable: subtotal };

  let discount =
    coupon.type === "percent" ? (coupon.value / 100) * subtotal : coupon.value;

  discount = Math.min(discount, coupon.maxDiscount || discount, subtotal);

  return {
    discount: Math.round(discount),
    payable: Math.round(subtotal - discount),
  };
};

/* =====================================================
   CREATE ORDER
   POST /api/checkout/create-order
   ✅ Requires login (because we need user id)
===================================================== */
router.post("/create-order", verifyAuth, async (req, res) => {
  try {
    if (!razorpay) {
      return res.status(500).json({ message: "Payment service unavailable" });
    }

    const { items, address, deliverySlot, couponCode } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
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

    // ✅ Normalize items (match schema)
    const normalizedItems = items.map((i) => {
      if (!i.mealId) throw new Error("Meal ID missing in cart item");
      if (!i.qty || i.qty < 1) throw new Error("Invalid quantity");

      return {
        meal: i.mealId,
        title: i.title,
        price: Number(i.price) || 0,
        protein: Number(i.protein) || 0,
        calories: Number(i.calories) || 0,
        qty: Number(i.qty),
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

    // Razorpay order create
    const rzpOrder = await razorpay.orders.create({
      amount: payable * 100, // paise
      currency: "INR",
      receipt: `rcpt_${Date.now()}`,
    });

    // Save order in DB
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

    return res.json({
      keyId: process.env.RAZORPAY_KEY_ID,
      razorpayOrderId: rzpOrder.id,
      amount: payable * 100,
      currency: "INR",
      orderId: order._id,
    });
  } catch (err) {
    console.error("❌ CREATE ORDER ERROR:", err);
    return res.status(500).json({
      message: err?.message || "Failed to create order",
    });
  }
});

/* =====================================================
   VERIFY PAYMENT
   POST /api/checkout/verify
   ✅ IMPORTANT FIX:
   - Removed verifyAuth so payment confirmation doesn't fail on expired token
   - Confirms orderId belongs to razorpayOrderId stored in DB
===================================================== */
router.post("/verify", async (req, res) => {
  try {
    const {
      orderId,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    if (!orderId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ message: "Missing payment verification fields" });
    }

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    // ✅ Ensure this verify request matches the correct Razorpay order
    if (order.payment?.razorpayOrderId !== razorpay_order_id) {
      return res.status(400).json({ message: "Razorpay order mismatch" });
    }

    // ✅ Verify signature
    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      order.payment.status = "failed";
      order.payment.razorpayPaymentId = razorpay_payment_id;
      order.payment.razorpaySignature = razorpay_signature;
      await order.save();
      return res.status(400).json({ message: "Payment verification failed" });
    }

    // ✅ Mark as paid
    order.payment.status = "paid";
    order.payment.razorpayPaymentId = razorpay_payment_id;
    order.payment.razorpaySignature = razorpay_signature;

    await order.save();

    return res.json({ message: "Payment verified successfully", order });
  } catch (err) {
    console.error("❌ VERIFY ERROR:", err);
    return res.status(500).json({
      message: err?.message || "Verification failed",
    });
  }
});

module.exports = router;
