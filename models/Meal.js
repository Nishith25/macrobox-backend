const mongoose = require("mongoose");

const mealSchema = new mongoose.Schema(
  {
    // Meal title (shown on cards & admin table)
    title: {
      type: String,
      required: true,
      trim: true,
    },

    // Short description (shown below title on home page)
    description: {
      type: String,
      default: "",
      trim: true,
    },

    // Image URL (Cloudinary / external URL)
    imageUrl: {
      type: String,
      required: true, // 🔥 IMPORTANT for UI consistency
    },

    // Nutrition info
    protein: {
      type: Number,
      required: true,
      min: 0,
    },

    calories: {
      type: Number,
      required: true,
      min: 0,
    },

    // Price per day pack
    price: {
      type: Number,
      required: true,
      min: 0,
    },

    // Controls display on Home page
    isFeatured: {
      type: Boolean,
      default: false,
      index: true, // ⚡ faster /meals/featured queries
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Meal", mealSchema);
