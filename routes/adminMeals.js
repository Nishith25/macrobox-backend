const express = require("express");
const { verifyAdmin } = require("../middleware/authMiddleware");
const Meal = require("../models/Meal");

const router = express.Router();

// CREATE MEAL
router.post("/", verifyAdmin, async (req, res) => {
  try {
    const meal = new Meal(req.body);
    await meal.save();
    res.status(201).json(meal);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE MEAL  ✅ FIXED
router.put("/:id", verifyAdmin, async (req, res) => {
  try {
    const meal = await Meal.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });

    if (!meal) return res.status(404).json({ message: "Meal not found" });

    res.json(meal);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET ALL MEALS
router.get("/", verifyAdmin, async (req, res) => {
  try {
    const meals = await Meal.find().sort({ createdAt: -1 });
    res.json(meals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE MEAL
router.delete("/:id", verifyAdmin, async (req, res) => {
  try {
    await Meal.findByIdAndDelete(req.params.id);
    res.json({ message: "Meal deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
