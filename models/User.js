const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },

    email: { type: String, required: true, unique: true },

    password: { type: String, required: true },

    role: { type: String, default: "user" },

    emailVerified: { type: Boolean, default: false },

    verificationToken: { type: String },

    resetPasswordToken: { type: String },

    resetPasswordExpires: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
