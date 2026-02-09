// backend/routes/checkout.js (BACKEND)
// MacroBox Checkout Routes - Single Time Slots + Slot Availability + Razorpay verify hardening
// ✅ Coupon usage increments only after successful payment
// ✅ Uses validFrom/validTo (inclusive validTo) with expiresAt fallback
// ✅ Auto-disables coupon if total usage limit reached (optional but recommended)

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

/* ================= SLOT RULES ================= */
const SLOT_START_HOUR = Number(process.env.DELIVERY_START_HOUR || 7);
const SLOT_END_HOUR = Number(process.env.DELIVERY_END_HOUR || 19);
const MIN_HOURS_BEFORE_SLOT = Number(process.env.DELIVERY_MIN_LEAD_HOURS || 3);

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
  const tm = timeHHmm.match(/^(\d{2}):00$/);
  if (!dm || !tm) return null;

  const year = Number(dm[1]);
  const month = Number(dm[2]);
  const day = Number(dm[3]);
  const hour = Number(tm[1]);

  if ([year, month, day, hour].some((x) => Number.isNaN(x))) return null;

  return new Date(year, month - 1, day, hour, 0, 0, 0);
};

const isSlotAtLeastHoursFromNow = (slotDateTime, hours) => {
  if (!(slotDateTime instanceof Date) || isNaN(slotDateTime.getTime())) return false;
  const minTime = Date.now() + hours * 60 * 60 * 1000;
  return slotDateTime.getTime() >= minTime;
};

/* ================= COUPON HELPERS ================= */

// Make "validTo" inclusive for the whole day (23:59:59.999)
const endOfDay = (d) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};

const resolveValidity = (coupon) => {
  const from = coupon?.validFrom ? new Date(coupon.validFrom) : null;

  let to = null;
  if (coupon?.validTo) to = endOfDay(coupon.validTo);
  else if (coupon?.expiresAt) to = new Date(coupon.expiresAt);

  return { from, to };
};

const computeDiscount = (subtotal, coupon) => {
  let discount = 0;

  if (coupon.type === "flat") {
    discount = Number(coupon.value || 0);
  } else {
    discount = Math.round((subtotal * Number(coupon.value || 0)) / 100);
    if (coupon.maxDiscount > 0) discount = Math.min(discount, coupon.maxDiscount);
  }

  discount = Math.min(discount, subtotal);
  return discount;
};

const validateCouponForUser = (coupon, userId, subtotal) => {
  // If couponCode not provided, we call with null and treat as OK with 0 discount
  if (!coupon) return { ok: true, discount: 0 };

  if (!coupon.isActive) return { ok: false, message: "Invalid coupon" };

  const now = new Date();
  const { from, to } = resolveValidity(coupon);

  if (from && now < from) return { ok: false, message: "Coupon not active yet" };
  if (to && now > to) return { ok: false, message: "Coupon expired" };

  if (subtotal < Number(coupon.minCartTotal || 0)) {
    return { ok: false, message: `Minimum cart total ₹${coupon.minCartTotal}` };
  }

  if (coupon.usageLimitTotal > 0 && coupon.usedCount >= coupon.usageLimitTotal) {
    return { ok: false, message: "Coupon usage limit reached" };
  }

  const usedBy = coupon.usedBy?.find((u) => String(u.user) === String(userId));
  const usedTimes = usedBy?.count || 0;

  if (usedTimes >= (coupon.usageLimitPerUser || 1)) {
    return { ok: false, message: "You already used this coupon" };
  }

  const discount = computeDiscount(subtotal, coupon);
  return { ok: true, discount };
};

/* ================= TOTALS ================= */
const computeTotals = (items) => {
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const totalProtein = items.reduce((s, i) => s + (i.protein || 0) * i.qty, 0);
  const totalCalories = items.reduce((s, i) => s + (i.calories || 0) * i.qty, 0);

  return {
    subtotal: Math.round(subtotal),
    totalProtein: Math.round(totalProtein),
    totalCalories: Math.round(totalCalories),
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

    // ✅ NEW: require google maps location
    const mode = address?.locationMode || "manual";
    if (mode === "current") {
      if (
        typeof address.lat !== "number" ||
        typeof address.lng !== "number" ||
        !String(address.mapsUrl || "").trim()
      ) {
        return res.status(400).json({ message: "Please provide current location." });
      }
    } else {
      if (!String(address.locationText || "").trim()) {
        return res.status(400).json({ message: "Please provide Google Maps location." });
      }
    }

    if (!deliverySlot?.date || !deliverySlot?.time) {
      return res.status(400).json({ message: "Delivery slot missing" });
    }

    // slot checks (no "3 hours" mention)
    if (!isValidSlotTime(deliverySlot.time)) {
      return res.status(400).json({ message: "Time slot is not available" });
    }

    const slotDateTime = parseSlotDateTime(deliverySlot.date, deliverySlot.time);
    if (!slotDateTime) {
      return res.status(400).json({ message: "Time slot is not available" });
    }
    if (!isSlotAtLeastHoursFromNow(slotDateTime, MIN_HOURS_BEFORE_SLOT)) {
      return res.status(400).json({ message: "Time slot is not available" });
    }

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

    const { subtotal, totalProtein, totalCalories } = computeTotals(normalizedItems);

    // coupon (validate but DO NOT increment usage here)
    let coupon = null;
    let discount = 0;

    if (couponCode) {
      coupon = await Coupon.findOne({
        code: String(couponCode).toUpperCase().trim(),
      });

      const v = validateCouponForUser(coupon, req.user._id, subtotal);
      if (!v.ok) return res.status(400).json({ message: v.message });
      discount = v.discount;
    }

    const payable = Math.max(subtotal - discount, 0);

    const rzpOrder = await razorpay.orders.create({
      amount: payable * 100,
      currency: "INR",
      receipt: `rcpt_${Date.now()}`,
    });

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
            redeemed: false, // ✅ prevents double usage increment
          }
        : undefined,
      delivery: {
        address, // ✅ will include location fields too
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
    return res.status(500).json({ message: err?.message || "Failed to create order" });
  }
});

/* =====================================================
   VERIFY PAYMENT
   POST /api/checkout/verify
   ✅ increments coupon usage ONLY after paid (and only once)
===================================================== */
router.post("/verify", async (req, res) => {
  try {
    const { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      req.body;

    if (!orderId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ message: "Missing payment verification fields" });
    }

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (order.payment?.razorpayOrderId !== razorpay_order_id) {
      return res.status(400).json({ message: "Razorpay order mismatch" });
    }

    // If already paid, just return (prevents double-increment)
    if (order.payment?.status === "paid") {
      return res.json({ message: "Payment already verified", order });
    }

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

    // ✅ increment coupon usage only ONCE
    if (order.coupon?.code && !order.coupon.redeemed) {
      const coupon = await Coupon.findOne({
        code: String(order.coupon.code).toUpperCase().trim(),
      });

      if (coupon) {
        const userId = order.user;

        const totalOk =
          coupon.usageLimitTotal === 0 || coupon.usedCount < coupon.usageLimitTotal;

        const idx = coupon.usedBy.findIndex((u) => String(u.user) === String(userId));
        const currentUserCount = idx >= 0 ? coupon.usedBy[idx].count : 0;
        const perUserOk = currentUserCount < (coupon.usageLimitPerUser || 1);

        if (totalOk && perUserOk) {
          coupon.usedCount += 1;

          if (idx >= 0) coupon.usedBy[idx].count += 1;
          else coupon.usedBy.push({ user: userId, count: 1 });

          if (coupon.usageLimitTotal > 0 && coupon.usedCount >= coupon.usageLimitTotal) {
            coupon.isActive = false;
          }

          await coupon.save();
        }
      }

      order.coupon.redeemed = true;
    }

    await order.save();

    return res.json({ message: "Payment verified successfully", order });
  } catch (err) {
    console.error("❌ VERIFY ERROR:", err);
    return res.status(500).json({ message: err?.message || "Verification failed" });
  }
});

module.exports = router;
