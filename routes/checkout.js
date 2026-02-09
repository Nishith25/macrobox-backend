// backend/routes/checkout.js
// (BACKEND) MacroBox Checkout Routes - Single Time Slots + Slot Availability + Razorpay verify hardening

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

/* ================= SLOT RULES =================
   - Allowed slots: 07:00 to 19:00 (hourly)
   - Customer can order only if selected slot is at least 3 hours from now
   - IMPORTANT: Do NOT show "3 hours" in error messages (just "Time slot is not available")
================================================ */
const SLOT_START_HOUR = Number(process.env.DELIVERY_START_HOUR || 7);
const SLOT_END_HOUR = Number(process.env.DELIVERY_END_HOUR || 19);
const MIN_HOURS_BEFORE_SLOT = Number(process.env.DELIVERY_MIN_LEAD_HOURS || 3);

const pad2 = (n) => String(n).padStart(2, "0");

// Expecting frontend to send:
// deliverySlot.date = "YYYY-MM-DD"
// deliverySlot.time = "HH:00" (24h)
const isValidSlotTime = (hhmm) => {
  if (typeof hhmm !== "string") return false;
  const match = hhmm.match(/^(\d{2}):00$/);
  if (!match) return false;

  const hour = Number(match[1]);
  if (Number.isNaN(hour)) return false;

  return hour >= SLOT_START_HOUR && hour <= SLOT_END_HOUR;
};

const parseSlotDateTime = (dateISO, timeHHmm) => {
  if (typeof dateISO !== "string" || typeof timeHHmm !== "string") return null;

  const dm = dateISO.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dm) return null;

  const tm = timeHHmm.match(/^(\d{2}):00$/);
  if (!tm) return null;

  const year = Number(dm[1]);
  const month = Number(dm[2]); // 1-12
  const day = Number(dm[3]);
  const hour = Number(tm[1]);

  if ([year, month, day, hour].some((x) => Number.isNaN(x))) return null;

  // local timezone date object
  return new Date(year, month - 1, day, hour, 0, 0, 0);
};

const isSlotAtLeastHoursFromNow = (slotDateTime, hours) => {
  if (!(slotDateTime instanceof Date) || isNaN(slotDateTime.getTime()))
    return false;

  const minTime = Date.now() + hours * 60 * 60 * 1000;
  return slotDateTime.getTime() >= minTime;
};

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
   ✅ Requires login (user id needed)
   ✅ Enforces slot rules on backend too
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

    // ✅ Slot format + range check (07:00 - 19:00)
    if (!isValidSlotTime(deliverySlot.time)) {
      return res.status(400).json({
        message: "Time slot is not available",
      });
    }

    // ✅ Slot date+time -> Date, enforce lead-time rule
    const slotDateTime = parseSlotDateTime(deliverySlot.date, deliverySlot.time);
    if (!slotDateTime) {
      return res.status(400).json({ message: "Time slot is not available" });
    }

    if (!isSlotAtLeastHoursFromNow(slotDateTime, MIN_HOURS_BEFORE_SLOT)) {
      return res.status(400).json({
        message: "Time slot is not available",
      });
    }

    // ✅ Normalize items (match Order schema)
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
        code: String(couponCode).toUpperCase(),
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
        slot: deliverySlot, // { date: "YYYY-MM-DD", time: "HH:00" }
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
   ✅ Removed verifyAuth so it doesn't fail if token expires after payment
   ✅ Checks razorpayOrderId matches DB order
===================================================== */
router.post("/verify", async (req, res) => {
  try {
    const {
      orderId,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    if (
      !orderId ||
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature
    ) {
      return res
        .status(400)
        .json({ message: "Missing payment verification fields" });
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
