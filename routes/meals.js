const express = require("express");
const Meal = require("../models/Meal");

const router = express.Router();

/**
 * GET /api/meals
 * Public – Get all meals
 */
router.get("/", async (req, res) => {
  try {
    const meals = await Meal.find().sort({ createdAt: -1 });
    res.status(200).json(meals);
  } catch (err) {
    console.error("Get meals error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * GET /api/meals/featured
 * Public – Home page (exactly 3 featured day packs)
 */
router.get("/featured", async (req, res) => {
  try {
    const featuredMeals = await Meal.find({ isFeatured: true })
      .sort({ updatedAt: -1 })
      .limit(3);

    res.status(200).json(featuredMeals);
  } catch (err) {
    console.error("Get featured meals error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * GET /api/meals/:id
 * Public – Get meal by ID
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
