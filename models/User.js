const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },

    email: { type: String, required: true, unique: true },

    password: { type: String, required: true },

    role: { type: String, default: "user" },

    emailVerified: { type: Boolean, default: false },

    verificationToken: String,
    resetPasswordToken: String,
    resetPasswordExpires: Date,

    /* ================= FAVORITES ================= */
    favorites: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Meal",
      },
    ],

    /* ================= DAY PLANS ================= */
    dayPlans: [
      {
        date: {
          type: Date,
          required: true,
        },
        items: [
          {
            meal: {
              type: mongoose.Schema.Types.ObjectId,
              ref: "Meal",
              required: true,
            },
            times: {
              type: [String],
              enum: ["breakfast", "lunch", "snack", "dinner"],
              required: true,
            },
          },
        ],
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
