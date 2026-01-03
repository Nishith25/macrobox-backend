const mongoose = require("mongoose");

const mealSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    protein: { type: Number, required: true },
    calories: { type: Number, required: true },
    price: { type: Number, required: true },
    imageUrl: { type: String, required: true },
    isFeatured: { type: Boolean, default: false },
    featuredOrder: { type: Number, default: 0,},
  },
  { timestamps: true }
);

module.exports = mongoose.model("Meal", mealSchema);
