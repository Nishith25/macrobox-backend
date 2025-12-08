const express = require("express");
const Meal = require("../models/Meal");

const router = express.Router();

// GET all meals
router.get("/", async (req, res) => {
  try {
    const meals = await Meal.find().sort({ createdAt: -1 });
    res.json(meals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET by ID
router.get("/:id", async (req, res) => {
  try {
    const meal = await Meal.findById(req.params.id);
    if (!meal) return res.status(404).json({ message: "Meal not found" });
    res.json(meal);
  } catch {
    res.status(400).json({ message: "Invalid ID" });
  }
});

module.exports = router;
