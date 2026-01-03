const express = require("express");
const Meal = require("../models/Meal");
const upload = require("../middleware/upload");

const router = express.Router();

/**
 * ======================================
 * GET ALL MEALS (ADMIN)
 * GET /api/admin/meals
 * ======================================
 */
router.get("/", async (req, res) => {
  try {
    const meals = await Meal.find().sort({ createdAt: -1 });
    res.status(200).json(meals);
  } catch (err) {
    console.error("❌ Admin get meals error:", err);
    res.status(500).json({ message: "Failed to fetch meals" });
  }
});

/**
 * ======================================
 * CREATE MEAL (ADMIN)
 * POST /api/admin/meals
 * ======================================
 */
router.post("/", upload.single("image"), async (req, res) => {
  try {
    console.log("REQ BODY:", req.body);
    console.log("REQ FILE:", req.file);

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
  } catch (err) {
    console.error("CREATE MEAL ERROR FULL:", err);
    res.status(500).json({ message: err.message });
  }
});


/**
 * ======================================
 * UPDATE MEAL (ADMIN)
 * PUT /api/admin/meals/:id
 * ======================================
 */
router.put("/:id", upload.single("image"), async (req, res) => {
  try {
    const meal = await Meal.findById(req.params.id);
    if (!meal) {
      return res.status(404).json({ message: "Meal not found" });
    }

    if (req.body.title !== undefined) meal.title = req.body.title;
    if (req.body.protein !== undefined) meal.protein = Number(req.body.protein);
    if (req.body.calories !== undefined)
      meal.calories = Number(req.body.calories);
    if (req.body.price !== undefined) meal.price = Number(req.body.price);

    if (req.body.isFeatured !== undefined) {
      meal.isFeatured = req.body.isFeatured === "true";
    }

    if (req.file) {
      meal.imageUrl = req.file.path;
    }

    await meal.save();
    res.status(200).json(meal);
  } catch (err) {
    console.error("❌ Update meal error:", err);
    res.status(500).json({ message: "Failed to update meal" });
  }
});

/**
 * ======================================
 * TOGGLE FEATURED (ADMIN)
 * PATCH /api/admin/meals/:id/featured
 * ======================================
 */
router.patch("/:id/featured", async (req, res) => {
  try {
    const { isFeatured } = req.body;

    if (typeof isFeatured === "undefined") {
      return res
        .status(400)
        .json({ message: "isFeatured value is required" });
    }

    const meal = await Meal.findByIdAndUpdate(
      req.params.id,
      { isFeatured: isFeatured === true || isFeatured === "true" },
      { new: true }
    );

    if (!meal) {
      return res.status(404).json({ message: "Meal not found" });
    }

    res.status(200).json(meal);
  } catch (err) {
    console.error("❌ Toggle featured error:", err);
    res.status(500).json({ message: "Could not update featured status" });
  }
});

/**
 * ======================================
 * DELETE MEAL (ADMIN)
 * DELETE /api/admin/meals/:id
 * ======================================
 */
router.delete("/:id", async (req, res) => {
  try {
    const meal = await Meal.findByIdAndDelete(req.params.id);

    if (!meal) {
      return res.status(404).json({ message: "Meal not found" });
    }

    res.status(200).json({ message: "Meal deleted" });
  } catch (err) {
    console.error("❌ Delete meal error:", err);
    res.status(500).json({ message: "Failed to delete meal" });
  }
});

module.exports = router;
