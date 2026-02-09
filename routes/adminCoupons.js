// backend/routes/adminCoupons.js (BACKEND)
const express = require("express");
const Coupon = require("../models/Coupon");
const { verifyAuth, verifyAdmin } = require("../middleware/auth");

const router = express.Router();

/* ===================== HELPERS ===================== */

// Normalize code, dates, numbers (STORE RAW DATES; inclusive handled in validation)
const normalizePayload = (body = {}) => {
  const payload = { ...body };

  if (payload.code) payload.code = String(payload.code).toUpperCase().trim();

  // enforce type (optional safety)
  if (payload.type && !["flat", "percent"].includes(payload.type)) {
    payload.type = "flat";
  }

  // Convert to Date (Frontend sends ISO string or YYYY-MM-DD ISO string)
  if (payload.validFrom) payload.validFrom = new Date(payload.validFrom);
  if (payload.validTo) payload.validTo = new Date(payload.validTo);
  if (payload.expiresAt) payload.expiresAt = new Date(payload.expiresAt);

  // Ensure numeric fields
  const numFields = [
    "value",
    "minCartTotal",
    "maxDiscount",
    "usageLimitTotal",
    "usageLimitPerUser",
  ];

  for (const f of numFields) {
    if (payload[f] !== undefined && payload[f] !== null && payload[f] !== "") {
      payload[f] = Number(payload[f]);
    }
  }

  // If flat, maxDiscount should be 0
  if (payload.type === "flat") payload.maxDiscount = 0;

  // defaults (safe)
  if (payload.usageLimitTotal === undefined) payload.usageLimitTotal = 0; // unlimited
  if (payload.usageLimitPerUser === undefined) payload.usageLimitPerUser = 1;

  return payload;
};

/* ===============================
   CREATE COUPON (ADMIN)
   POST /api/admin/coupons
================================ */
router.post("/", verifyAuth, verifyAdmin, async (req, res) => {
  try {
    const payload = normalizePayload(req.body);
    const created = await Coupon.create(payload);
    return res.status(201).json(created);
  } catch (err) {
    console.error("Create coupon error:", err);

    // duplicate code (if Coupon schema has unique: true on code)
    if (err?.code === 11000) {
      return res.status(400).json({ message: "Coupon code already exists" });
    }

    return res.status(400).json({ message: "Coupon creation failed" });
  }
});

/* ===============================
   GET ALL COUPONS (ADMIN)
   GET /api/admin/coupons
================================ */
router.get("/", verifyAuth, verifyAdmin, async (req, res) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 });
    return res.json(coupons);
  } catch (err) {
    console.error("Get coupons error:", err);
    return res.status(500).json({ message: "Failed to fetch coupons" });
  }
});

/* ===============================
   TOGGLE ACTIVE (ADMIN)
   PATCH /api/admin/coupons/:id/toggle
================================ */
router.patch("/:id/toggle", verifyAuth, verifyAdmin, async (req, res) => {
  try {
    const c = await Coupon.findById(req.params.id);
    if (!c) return res.status(404).json({ message: "Coupon not found" });

    c.isActive = !c.isActive;
    await c.save();
    return res.json(c);
  } catch (err) {
    console.error("Toggle coupon error:", err);
    return res.status(500).json({ message: "Failed to toggle coupon" });
  }
});

/* ===============================
   UPDATE COUPON (ADMIN)
   PATCH /api/admin/coupons/:id
================================ */
router.patch("/:id", verifyAuth, verifyAdmin, async (req, res) => {
  try {
    const payload = normalizePayload(req.body);

    const updated = await Coupon.findByIdAndUpdate(req.params.id, payload, {
      new: true,
    });

    if (!updated) return res.status(404).json({ message: "Coupon not found" });
    return res.json(updated);
  } catch (err) {
    console.error("Update coupon error:", err);

    if (err?.code === 11000) {
      return res.status(400).json({ message: "Coupon code already exists" });
    }

    return res.status(500).json({ message: "Failed to update coupon" });
  }
});

/* ===============================
   DELETE COUPON (ADMIN)
   DELETE /api/admin/coupons/:id
================================ */
router.delete("/:id", verifyAuth, verifyAdmin, async (req, res) => {
  try {
    await Coupon.findByIdAndDelete(req.params.id);
    return res.json({ message: "Coupon deleted" });
  } catch (err) {
    console.error("Delete coupon error:", err);
    return res.status(500).json({ message: "Failed to delete coupon" });
  }
});

module.exports = router;
