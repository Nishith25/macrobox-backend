// macrobox-backend/routes/adminMeals.js (BACKEND)
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
    return res.status(200).json(meals);
  } catch (err) {
    console.error("❌ Admin get meals error:", err);
    return res.status(500).json({ message: "Failed to fetch meals" });
  }
});

/**
 * ======================================
 * REORDER FEATURED MEALS (ADMIN)
 * PATCH /api/admin/meals/reorder
 * Body: { orderedIds: ["id1","id2",...] }
 * ======================================
 * ✅ Must be ABOVE "/:id" routes to avoid conflict
 */
router.patch("/reorder", async (req, res) => {
  try {
    const { orderedIds } = req.body;

    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      return res.status(400).json({ message: "Invalid order data" });
    }

    // update featuredOrder based on new order
    await Promise.all(
      orderedIds.map((id, index) =>
        Meal.findByIdAndUpdate(id, { featuredOrder: index })
      )
    );

    return res.json({ message: "Featured meals reordered" });
  } catch (err) {
    console.error("❌ Reorder failed:", err);
    return res.status(500).json({ message: "Reorder failed" });
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
    const { title, protein, calories, price, isFeatured } = req.body;

    if (!title || protein === undefined || calories === undefined || price === undefined) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "Image is required" });
    }

    // if featured, put it at end of featured list
    let featuredOrder = 0;
    const wantFeatured = isFeatured === "true" || isFeatured === true;

    if (wantFeatured) {
      const last = await Meal.findOne({ isFeatured: true }).sort({ featuredOrder: -1 });
      featuredOrder = last ? (last.featuredOrder || 0) + 1 : 0;
    }

    const meal = await Meal.create({
      title: String(title).trim(),
      protein: Number(protein),
      calories: Number(calories),
      price: Number(price),
      imageUrl: req.file.path,
      isFeatured: wantFeatured,
      featuredOrder,
    });

    return res.status(201).json(meal);
  } catch (err) {
    console.error("❌ CREATE MEAL ERROR FULL:", err);
    return res.status(500).json({ message: err?.message || "Failed to create meal" });
  }
});

/**
 * ======================================
 * TOGGLE FEATURED (ADMIN)
 * PATCH /api/admin/meals/:id/featured
 * body: { isFeatured: true/false }
 * ======================================
 */
router.patch("/:id/featured", async (req, res) => {
  try {
    const { isFeatured } = req.body;

    if (typeof isFeatured === "undefined") {
      return res.status(400).json({ message: "isFeatured value is required" });
    }

    const wantFeatured = isFeatured === true || isFeatured === "true";

    // if turning ON featured, push to end of featured list
    let update = { isFeatured: wantFeatured };

    if (wantFeatured) {
      const last = await Meal.findOne({ isFeatured: true }).sort({ featuredOrder: -1 });
      update.featuredOrder = last ? (last.featuredOrder || 0) + 1 : 0;
    }

    const meal = await Meal.findByIdAndUpdate(req.params.id, update, { new: true });

    if (!meal) return res.status(404).json({ message: "Meal not found" });

    return res.status(200).json(meal);
  } catch (err) {
    console.error("❌ Toggle featured error:", err);
    return res.status(500).json({ message: "Could not update featured status" });
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
    if (!meal) return res.status(404).json({ message: "Meal not found" });

    if (req.body.title !== undefined) meal.title = String(req.body.title).trim();
    if (req.body.protein !== undefined) meal.protein = Number(req.body.protein);
    if (req.body.calories !== undefined) meal.calories = Number(req.body.calories);
    if (req.body.price !== undefined) meal.price = Number(req.body.price);

    // IMPORTANT: do not toggle featured here; use /:id/featured route
    // (keeps ordering logic consistent)

    if (req.file) {
      meal.imageUrl = req.file.path;
    }

    await meal.save();
    return res.status(200).json(meal);
  } catch (err) {
    console.error("❌ Update meal error:", err);
    return res.status(500).json({ message: "Failed to update meal" });
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
    if (!meal) return res.status(404).json({ message: "Meal not found" });

    return res.status(200).json({ message: "Meal deleted" });
  } catch (err) {
    console.error("❌ Delete meal error:", err);
    return res.status(500).json({ message: "Failed to delete meal" });
  }
});

module.exports = router;
