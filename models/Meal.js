const mongoose = require("mongoose");

const mealSchema = new mongoose.Schema(
  {
    title: String,
    description: String,
    protein: Number,
    calories: Number,
    image: String,
    tags: [String],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Meal", mealSchema);
