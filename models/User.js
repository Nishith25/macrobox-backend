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

    /* ================= BODY METRICS ================= */
bodyMetrics: {
  height: Number,
  weight: Number,
  age: Number,
  gender: {
    type: String,
    enum: ["male", "female"],
  },
  activity: {
    type: String,
    enum: ["sedentary", "light", "moderate", "active", "very_active"],
  },
  goalWeight: Number,
  locked: {
    type: Boolean,
    default: false,
  },
},


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
