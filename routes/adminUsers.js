const express = require("express");
const { verifyAuth, verifyAdmin } = require("../middleware/auth"); // ✅ FIX
const User = require("../models/User");

const router = express.Router();

// GET all users (admin only)
router.get("/", verifyAuth, verifyAdmin, async (req, res) => {
  try {
    const users = await User.find().select("-password");
    res.json(users);
  } catch (err) {
    console.error("Admin get users error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// UPDATE user role (admin only)
router.patch("/:id/role", verifyAuth, verifyAdmin, async (req, res) => {
  try {
    const { role } = req.body;

    if (!["user", "admin"].includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  } catch (err) {
    console.error("Admin update role error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
