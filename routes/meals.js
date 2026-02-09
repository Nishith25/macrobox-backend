// macrobox-backend/routes/meals.js (BACKEND)
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
      .sort({ featuredOrder: 1 })
      .lean();

    return res.json(meals);
  } catch (err) {
    console.error("Failed to fetch featured meals:", err);
    return res.status(500).json({ message: "Failed to fetch featured meals" });
  }
});

/**
 * ======================================
 * GET MEALS (PUBLIC)
 * GET /api/meals
 *
 * ✅ Default: returns ONLY NON-FEATURED meals (Meals page)
 *
 * Optional query params:
 * - /api/meals?featured=true  -> only featured
 * - /api/meals?featured=false -> only non-featured
 * - /api/meals?all=true       -> all meals (featured + non-featured)
 * ======================================
 */
router.get("/", async (req, res) => {
  try {
    const featured = req.query.featured;
    const all = req.query.all;

    const allBool = String(all).toLowerCase() === "true";

    // ✅ if explicitly asked for all, return everything
    if (allBool) {
      const meals = await Meal.find().sort({ createdAt: -1 }).lean();
      return res.status(200).json(meals);
    }

    // ✅ if featured query exists, respect it
    if (featured !== undefined) {
      const wantFeatured = String(featured).toLowerCase() === "true";

      const meals = await Meal.find({ isFeatured: wantFeatured })
        .sort(wantFeatured ? { featuredOrder: 1 } : { createdAt: -1 })
        .lean();

      return res.status(200).json(meals);
    }

    // ✅ default: NON-featured only
    const meals = await Meal.find({ isFeatured: false })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json(meals);
  } catch (err) {
    console.error("Get meals error:", err);
    return res.status(500).json({ message: "Failed to fetch meals" });
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
    const meal = await Meal.findById(req.params.id).lean();

    if (!meal) {
      return res.status(404).json({ message: "Meal not found" });
    }

    return res.status(200).json(meal);
  } catch (err) {
    console.error("Get meal by ID error:", err);
    return res.status(400).json({ message: "Invalid meal ID" });
  }
});

module.exports = router;
