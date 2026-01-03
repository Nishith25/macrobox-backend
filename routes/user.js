const express = require("express");
const { verifyAuth } = require("../middleware/auth");
const User = require("../models/User");

const router = express.Router();

/* ======================================
   GET CURRENT USER
   GET /api/user/me
====================================== */
router.get("/me", verifyAuth, async (req, res) => {
  const user = await User.findById(req.user._id)
    .populate("favorites")
    .populate("dayPlans.items.meal");

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  res.json(user);
});

/* ======================================
   GET LAST 15 DAY PLANS
   GET /api/user/day-plan
====================================== */
router.get("/day-plan", verifyAuth, async (req, res) => {
  const user = await User.findById(req.user._id)
    .populate("dayPlans.items.meal");

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  const plans = [...user.dayPlans]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 15);

  res.json(plans);
});

/* ======================================
   SAVE TODAY PLAN
   POST /api/user/day-plan
====================================== */
router.post("/day-plan", verifyAuth, async (req, res) => {
  const { items } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: "No plan items provided" });
  }

  const user = await User.findById(req.user._id);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Remove existing plan for today
  user.dayPlans = user.dayPlans.filter(
    (p) => new Date(p.date).getTime() !== today.getTime()
  );

  user.dayPlans.push({
    date: today,
    items: items.map((i) => ({
      meal: i.mealId,
      times: i.times,
    })),
  });


  // Keep only last 15 days
  if (user.dayPlans.length > 15) {
    user.dayPlans = user.dayPlans.slice(-15);
  }

  await user.save();

  res.json({ message: "Day plan saved successfully" });
});
 /* ======================================
   SAVE / UPDATE BODY METRICS
   POST /api/user/body-metrics
====================================== */
router.post("/body-metrics", verifyAuth, async (req, res) => {
  const {
    height,
    weight,
    age,
    gender,
    activity,
    goalWeight,
    locked,
  } = req.body;

  const user = await User.findById(req.user._id);

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  user.bodyMetrics = {
    height,
    weight,
    age,
    gender,
    activity,
    goalWeight,
    locked,
  };

  await user.save();

  res.json({
    message: "Body metrics saved",
    bodyMetrics: user.bodyMetrics,
  });
});

/* ======================================
   DELETE PLAN
   DELETE /api/user/day-plan/:id
====================================== */
router.delete("/day-plan/:id", verifyAuth, async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  user.dayPlans = user.dayPlans.filter(
    (p) => p._id.toString() !== req.params.id
  );

  await user.save();

  res.json({ message: "Plan deleted" });
});

module.exports = router;
