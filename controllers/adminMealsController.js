const Meal = require("../models/Meal");

// CREATE MEAL
exports.createMeal = async (req, res) => {
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
      isFeatured: isFeatured === "true",
      imageUrl: req.file.path, // ✅ Cloudinary URL
    });

    res.status(201).json(meal);
  } catch (err) {
    console.error("❌ CREATE MEAL ERROR:", err);
    res.status(500).json({ message: "Failed to create meal" });
  }
};

// GET ALL
exports.getAllMeals = async (req, res) => {
  const meals = await Meal.find().sort({ createdAt: -1 });
  res.json(meals);
};

// TOGGLE FEATURED
exports.toggleFeatured = async (req, res) => {
  const meal = await Meal.findByIdAndUpdate(
    req.params.id,
    { isFeatured: req.body.isFeatured },
    { new: true }
  );

  if (!meal) return res.status(404).json({ message: "Meal not found" });
  res.json(meal);
};

// UPDATE
exports.updateMeal = async (req, res) => {
  const meal = await Meal.findById(req.params.id);
  if (!meal) return res.status(404).json({ message: "Meal not found" });

  meal.title = req.body.title ?? meal.title;
  meal.protein = req.body.protein ?? meal.protein;
  meal.calories = req.body.calories ?? meal.calories;
  meal.price = req.body.price ?? meal.price;
  meal.isFeatured =
    req.body.isFeatured !== undefined
      ? req.body.isFeatured === "true"
      : meal.isFeatured;

  if (req.file) meal.imageUrl = req.file.path;

  await meal.save();
  res.json(meal);
};

// DELETE
exports.deleteMeal = async (req, res) => {
  await Meal.findByIdAndDelete(req.params.id);
  res.json({ message: "Meal deleted" });
};
