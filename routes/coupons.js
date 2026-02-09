// backend/routes/coupons.js (BACKEND)
const express = require("express");
const Coupon = require("../models/Coupon");
const { verifyAuth, verifyAdmin } = require("../middleware/auth");

const router = express.Router();

/* ===================== HELPERS ===================== */

// Make "validTo" inclusive for the whole day (23:59:59.999)
const endOfDay = (d) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};

const resolveValidity = (coupon) => {
  // Prefer validFrom/validTo, fallback to expiresAt
  const from = coupon.validFrom ? new Date(coupon.validFrom) : null;

  let to = null;
  if (coupon.validTo) to = endOfDay(coupon.validTo);
  else if (coupon.expiresAt) to = new Date(coupon.expiresAt);

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

const userUsedCount = (coupon, userId) => {
  const row = coupon.usedBy?.find((u) => String(u.user) === String(userId));
  return row?.count || 0;
};

const isEligibleForUser = (coupon, userId, subtotal) => {
  if (!coupon.isActive) return false;

  const now = new Date();
  const { from, to } = resolveValidity(coupon);

  if (from && now < from) return false;
  if (to && now > to) return false;

  if (subtotal < Number(coupon.minCartTotal || 0)) return false;

  if (coupon.usageLimitTotal > 0 && (coupon.usedCount || 0) >= coupon.usageLimitTotal) {
    return false;
  }

  const usedTimes = userUsedCount(coupon, userId);
  const perUserLimit = coupon.usageLimitPerUser || 1;
  if (usedTimes >= perUserLimit) return false;

  return true;
};

/* =========================
   ✅ AVAILABLE COUPONS (USER)
   GET /api/coupons/available?cartTotal=123
   Returns only eligible coupons for this user
========================= */
router.get("/available", verifyAuth, async (req, res) => {
  try {
    const subtotal = Number(req.query.cartTotal || 0);

    // Pull active coupons only (faster)
    const coupons = await Coupon.find({ isActive: true }).sort({ createdAt: -1 });

    const eligible = coupons
      .filter((c) => isEligibleForUser(c, req.user._id, subtotal))
      .map((c) => ({
        code: c.code,
        type: c.type,
        value: c.value,
        minCartTotal: c.minCartTotal || 0,
        maxDiscount: c.maxDiscount || 0,
        validFrom: c.validFrom || null,
        validTo: c.validTo || null,
      }));

    return res.json(eligible);
  } catch (err) {
    console.error("Available coupons error:", err);
    return res.status(500).json({ message: "Failed to fetch available coupons" });
  }
});

/* =========================
   APPLY COUPON (USER)
   POST /api/coupons/apply
========================= */
router.post("/apply", verifyAuth, async (req, res) => {
  try {
    const { code, cartTotal } = req.body;

    if (!code) return res.status(400).json({ message: "Coupon code required" });

    const coupon = await Coupon.findOne({
      code: String(code).toUpperCase().trim(),
    });

    if (!coupon || !coupon.isActive) {
      return res.status(400).json({ message: "Invalid coupon" });
    }

    const now = new Date();
    const { from, to } = resolveValidity(coupon);

    if (from && now < from) return res.status(400).json({ message: "Coupon not active yet" });
    if (to && now > to) return res.status(400).json({ message: "Coupon expired" });

    const subtotal = Number(cartTotal || 0);
    if (subtotal < coupon.minCartTotal) {
      return res.status(400).json({ message: `Minimum cart total ₹${coupon.minCartTotal}` });
    }

    // total usage
    if (coupon.usageLimitTotal > 0 && coupon.usedCount >= coupon.usageLimitTotal) {
      return res.status(400).json({ message: "Coupon usage limit reached" });
    }

    // per user usage
    const usedTimes = userUsedCount(coupon, req.user._id);
    if (usedTimes >= (coupon.usageLimitPerUser || 1)) {
      return res.status(400).json({ message: "You already used this coupon" });
    }

    const discount = computeDiscount(subtotal, coupon);

    return res.json({
      code: coupon.code,
      discount,
    });
  } catch (err) {
    console.error("Coupon apply error:", err);
    res.status(500).json({ message: "Failed to apply coupon" });
  }
});

/* =========================
   ADMIN: CREATE COUPON
   POST /api/coupons
========================= */
router.post("/", verifyAuth, verifyAdmin, async (req, res) => {
  try {
    const payload = { ...req.body };
    payload.code = String(payload.code).toUpperCase().trim();

    const created = await Coupon.create(payload);
    res.status(201).json(created);
  } catch (err) {
    console.error("Create coupon error:", err);
    res.status(500).json({ message: "Failed to create coupon" });
  }
});

/* =========================
   ADMIN: GET ALL
   GET /api/coupons
========================= */
router.get("/", verifyAuth, verifyAdmin, async (req, res) => {
  const coupons = await Coupon.find().sort({ createdAt: -1 });
  res.json(coupons);
});

/* =========================
   ADMIN: TOGGLE ACTIVE
   PATCH /api/coupons/:id/toggle
========================= */
router.patch("/:id/toggle", verifyAuth, verifyAdmin, async (req, res) => {
  const c = await Coupon.findById(req.params.id);
  if (!c) return res.status(404).json({ message: "Coupon not found" });

  c.isActive = !c.isActive;
  await c.save();
  res.json(c);
});

/* =========================
   ADMIN: DELETE
   DELETE /api/coupons/:id
========================= */
router.delete("/:id", verifyAuth, verifyAdmin, async (req, res) => {
  await Coupon.findByIdAndDelete(req.params.id);
  res.json({ message: "Coupon deleted" });
});

module.exports = router;
