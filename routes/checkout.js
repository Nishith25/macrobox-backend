const express = require("express");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const Order = require("../models/Order");
const Coupon = require("../models/Coupon");
const { verifyAuth } = require("../middleware/auth"); // ✅ FIX

const router = express.Router();

/* ===========================
   RAZORPAY INSTANCE (SAFE)
=========================== */
if (
  !process.env.RAZORPAY_KEY_ID ||
  !process.env.RAZORPAY_KEY_SECRET
) {
  console.error("❌ Razorpay keys missing in .env");
  throw new Error("Razorpay configuration error");
}

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

/* ===========================
   HELPERS
=========================== */
function computeSubtotal(items) {
  return items.reduce((sum, i) => sum + i.price * i.qty, 0);
}

function applyCoupon(subtotal, coupon) {
  if (!coupon || !coupon.isActive) {
    return { discount: 0, total: subtotal };
  }

  if (coupon.expiry && new Date(coupon.expiry) < new Date()) {
    return { discount: 0, total: subtotal };
  }

  if (subtotal < coupon.minCartValue) {
    return { discount: 0, total: subtotal };
  }

  let discount = 0;

  if (coupon.type === "flat") {
    discount = coupon.value;
  } else if (coupon.type === "percent") {
    discount = (coupon.value / 100) * subtotal;
  }

  discount = Math.min(discount, coupon.maxDiscount || discount);
  discount = Math.min(discount, subtotal);

  return {
    discount: Math.round(discount),
    total: Math.round(subtotal - discount),
  };
}

/* =====================================================
   CREATE RAZORPAY ORDER + DB ORDER
   POST /api/checkout/create-order
===================================================== */
router.post("/create-order", verifyAuth, async (req, res) => {
  try {
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


    const subtotal = computeSubtotal(items);

    let coupon = null;
    if (couponCode) {
      coupon = await Coupon.findOne({
        code: couponCode.toUpperCase(),
      });
    }

    const { discount, total } = applyCoupon(subtotal, coupon);

    /* ---- Razorpay order (amount in paise) ---- */
    const rzpOrder = await razorpay.orders.create({
      amount: total * 100,
      currency: "INR",
      receipt: `rcpt_${Date.now()}`,
    });

    /* ---- Save DB order ---- */
    const dbOrder = await Order.create({
  userId: req.user.id,
  items,
  subtotal,
  discount,
  total,
  couponCode: coupon ? coupon.code : null,
  address,
  deliverySlot,
  payment: {
    razorpayOrderId: rzpOrder.id,
    status: "created",
  },
});


    res.json({
      keyId: process.env.RAZORPAY_KEY_ID,
      razorpayOrderId: rzpOrder.id,
      amount: total * 100,
      currency: "INR",
      orderId: dbOrder._id,
    });
  } catch (err) {
    console.error("❌ CREATE ORDER ERROR:", err);
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

    order.payment.razorpayPaymentId = razorpay_payment_id;
    order.payment.razorpaySignature = razorpay_signature;
    order.payment.status = "paid";
    await order.save();

    res.json({ message: "Payment verified successfully", order });
  } catch (err) {
    console.error("❌ VERIFY ERROR:", err);
    res.status(500).json({ message: "Payment verification failed" });
  }
});

module.exports = router;
