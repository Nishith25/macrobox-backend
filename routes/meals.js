const express = require("express");
const Meal = require("../models/Meal");

const router = express.Router();

/**
 * ======================================
 * GET FEATURED MEALS (PUBLIC)
 * GET /api/meals/featured
 * Used by Home.tsx
 * ======================================
 */
router.get("/featured", async (req, res) => {
  try {
    const meals = await Meal.find({ isFeatured: true })
      .sort({ createdAt: -1 })
      .limit(3);

    res.status(200).json(meals);
  } catch (err) {
    console.error("Featured meals error:", err);
    res.status(500).json({ message: "Failed to fetch featured meals" });
  }
});

/**
 * ======================================
 * GET ALL MEALS (PUBLIC)
 * GET /api/meals
 * Used by Meals page
 * ======================================
 */
router.get("/", async (req, res) => {
  try {
    const meals = await Meal.find().sort({ createdAt: -1 });
    res.status(200).json(meals);
  } catch (err) {
    console.error("Get meals error:", err);
    res.status(500).json({ message: "Failed to fetch meals" });
  }
});

/**
 * ======================================
 * GET MEAL BY ID (PUBLIC)
 * GET /api/meals/:id
 * Used by MealDetails page
 * ======================================
 */
router.get("/:id", async (req, res) => {
  try {
    const meal = await Meal.findById(req.params.id);

    if (!meal) {
      return res.status(404).json({ message: "Meal not found" });
    }

    res.status(200).json(meal);
  } catch (err) {
    console.error("Get meal by ID error:", err);
    res.status(400).json({ message: "Invalid meal ID" });
  }
});

module.exports = router;
