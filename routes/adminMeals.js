const express = require("express");
const Meal = require("../models/Meal");
const upload = require("../middleware/upload");

const router = express.Router();

// GET ALL MEALS
router.get("/", async (req, res) => {
  try {
    const meals = await Meal.find().sort({ createdAt: -1 });
    res.json(meals);
  } catch {
    res.status(500).json({ message: "Failed to fetch meals" });
  }
});

// ADD MEAL
router.post("/", upload.single("image"), async (req, res) => {
  try {
    const { title, protein, calories, price, isFeatured } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: "Image is required" });
    }

    const meal = await Meal.create({
      title,
      protein: Number(protein),
      calories: Number(calories),
      price: Number(price),
      imageUrl: req.file.path,
      isFeatured: isFeatured === "true",
    });

    res.status(201).json(meal);
  } catch {
    res.status(500).json({ message: "Failed to add meal" });
  }
});

// TOGGLE FEATURED (PATCH)
router.patch("/:id/featured", async (req, res) => {
  const meal = await Meal.findByIdAndUpdate(
    req.params.id,
    { isFeatured: req.body.isFeatured },
    { new: true }
  );

  if (!meal) return res.status(404).json({ message: "Meal not found" });
  res.json(meal);
});

// FALLBACKS
router.put("/:id/featured", async (req, res) => {
  const meal = await Meal.findByIdAndUpdate(
    req.params.id,
    { isFeatured: req.body.isFeatured },
    { new: true }
  );

  if (!meal) return res.status(404).json({ message: "Meal not found" });
  res.json(meal);
});

router.post("/:id/featured", async (req, res) => {
  const meal = await Meal.findByIdAndUpdate(
    req.params.id,
    { isFeatured: req.body.isFeatured },
    { new: true }
  );

  if (!meal) return res.status(404).json({ message: "Meal not found" });
  res.json(meal);
});

// UPDATE MEAL
router.put("/:id", upload.single("image"), async (req, res) => {
  const meal = await Meal.findById(req.params.id);
  if (!meal) return res.status(404).json({ message: "Meal not found" });

  Object.assign(meal, {
    title: req.body.title ?? meal.title,
    protein: req.body.protein ?? meal.protein,
    calories: req.body.calories ?? meal.calories,
    price: req.body.price ?? meal.price,
    isFeatured:
      req.body.isFeatured !== undefined
        ? req.body.isFeatured === "true"
        : meal.isFeatured,
  });

  if (req.file) meal.imageUrl = req.file.path;

  await meal.save();
  res.json(meal);
});

// DELETE
router.delete("/:id", async (req, res) => {
  await Meal.findByIdAndDelete(req.params.id);
  res.json({ message: "Meal deleted" });
});

module.exports = router;
