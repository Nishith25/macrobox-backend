const express = require("express");
const Coupon = require("../models/Coupon");
const { verifyAuth, verifyAdmin } = require("../middleware/auth");

const router = express.Router();

/* ===============================
   CREATE COUPON (ADMIN)
   POST /api/admin/coupons
================================ */
router.post("/", verifyAuth, verifyAdmin, async (req, res) => {
  try {
    const coupon = await Coupon.create(req.body);
    res.status(201).json(coupon);
  } catch (err) {
    res.status(400).json({ message: "Coupon creation failed" });
  }
});

/* ===============================
   GET ALL COUPONS (ADMIN)
   GET /api/admin/coupons
================================ */
router.get("/", verifyAuth, verifyAdmin, async (req, res) => {
  const coupons = await Coupon.find().sort({ createdAt: -1 });
  res.json(coupons);
});

/* ===============================
   TOGGLE COUPON STATUS
   PATCH /api/admin/coupons/:id
================================ */
router.patch("/:id", verifyAuth, verifyAdmin, async (req, res) => {
  const coupon = await Coupon.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true }
  );
  res.json(coupon);
});

module.exports = router;
