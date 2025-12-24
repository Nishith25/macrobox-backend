const express = require("express");
const { verifyAuth } = require("../middleware/auth"); // ✅ FIX
const User = require("../models/User");
const Meal = require("../models/Meal");

const router = express.Router();

// GET /api/user/me
router.get("/me", verifyAuth, async (req, res) => {
  const user = await User.findById(req.user._id)
    .populate("favorites")
    .populate("dayPlan.meal");

  res.json({
    id: user._id,
    name: user.name,
    email: user.email,
    favorites: user.favorites,
    dayPlan: user.dayPlan,
  });
});

// POST /api/user/day-plan
router.post("/day-plan", verifyAuth, async (req, res) => {
  const { items } = req.body;

  const user = await User.findById(req.user._id);
  user.dayPlan = items.map((it) => ({
    meal: it.mealId,
    timeOfDay: it.timeOfDay || "lunch",
  }));

  await user.save();
  res.json({ message: "Day plan saved", dayPlan: user.dayPlan });
});

// POST /api/user/favorites/:mealId (toggle)
router.post("/favorites/:mealId", verifyAuth, async (req, res) => {
  const { mealId } = req.params;
  const user = await User.findById(req.user._id);

  const exists = user.favorites.find(
    (id) => id.toString() === mealId
  );

  if (exists) {
    user.favorites = user.favorites.filter(
      (id) => id.toString() !== mealId
    );
  } else {
    const meal = await Meal.findById(mealId);
    if (!meal) return res.status(404).json({ message: "Meal not found" });
    user.favorites.push(mealId);
  }

  await user.save();
  res.json({ message: "Favorites updated", favorites: user.favorites });
});

module.exports = router;
