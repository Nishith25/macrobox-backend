const express = require("express");
const { verifyAuth, verifyAdmin } = require("../middleware/auth");
const User = require("../models/User");

const router = express.Router();

/**
 * GET /api/admin/users
 * Admin-only: Get all users
 */
router.get("/", verifyAuth, verifyAdmin, async (req, res) => {
  try {
    const users = await User.find().select("-password");
    res.status(200).json(users);
  } catch (err) {
    console.error("Admin get users error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * PATCH /api/admin/users/:id/role
 * Admin-only: Update user role
 */
router.patch("/:id/role", verifyAuth, verifyAdmin, async (req, res) => {
  try {
    const { role } = req.body;

    // Validate role
    if (!["user", "admin"].includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    // 🚨 Prevent admin from demoting themselves
    if (req.user.id === req.params.id && role !== "admin") {
      return res
        .status(403)
        .json({ message: "You cannot change your own admin role" });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json(user);
  } catch (err) {
    console.error("Admin update role error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
