// backend/routes/adminUsers.js
const express = require("express");
const User = require("../models/User");
const { verifyAuth, verifyAdmin } = require("../middleware/auth");

const router = express.Router();

/**
 * GET /api/admin/users
 * Admin-only: Get all users
 * (Returns key fields + status flags; excludes password)
 */
router.get("/", verifyAuth, verifyAdmin, async (req, res) => {
  try {
    const users = await User.find({})
      .select(
        "name email role isFrozen frozenAt isDeactivated deactivatedAt createdAt updatedAt"
      )
      .sort({ createdAt: -1 });

    res.status(200).json(users);
  } catch (err) {
    console.error("ADMIN USERS GET ERROR:", err);
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

/**
 * PATCH /api/admin/users/:id/deactivate
 * Admin-only: Deactivate user
 */
router.patch("/:id/deactivate", verifyAuth, verifyAdmin, async (req, res) => {
  try {
    // 🚫 Prevent admin from deactivating themselves
    if (req.user._id.toString() === req.params.id) {
      return res.status(400).json({ message: "You cannot deactivate yourself" });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isDeactivated: true, deactivatedAt: new Date() },
      { new: true }
    ).select("name email role isFrozen frozenAt isDeactivated deactivatedAt");

    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json({ message: "User deactivated", user });
  } catch (err) {
    console.error("DEACTIVATE ERROR:", err);
    res.status(500).json({ message: "Failed to deactivate user" });
  }
});

/**
 * PATCH /api/admin/users/:id/activate
 * Admin-only: Activate (undo deactivate)
 */
router.patch("/:id/activate", verifyAuth, verifyAdmin, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isDeactivated: false, deactivatedAt: null },
      { new: true }
    ).select("name email role isFrozen frozenAt isDeactivated deactivatedAt");

    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json({ message: "User activated", user });
  } catch (err) {
    console.error("ACTIVATE ERROR:", err);
    res.status(500).json({ message: "Failed to activate user" });
  }
});

/**
 * PATCH /api/admin/users/:id/freeze
 * Admin-only: Freeze user
 */
router.patch("/:id/freeze", verifyAuth, verifyAdmin, async (req, res) => {
  try {
    // 🚫 Prevent admin from freezing themselves
    if (req.user._id.toString() === req.params.id) {
      return res.status(400).json({ message: "You cannot freeze yourself" });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isFrozen: true, frozenAt: new Date() },
      { new: true }
    ).select("name email role isFrozen frozenAt isDeactivated deactivatedAt");

    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json({ message: "User frozen", user });
  } catch (err) {
    console.error("FREEZE ERROR:", err);
    res.status(500).json({ message: "Failed to freeze user" });
  }
});

/**
 * PATCH /api/admin/users/:id/unfreeze
 * Admin-only: Unfreeze user
 */
router.patch("/:id/unfreeze", verifyAuth, verifyAdmin, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isFrozen: false, frozenAt: null },
      { new: true }
    ).select("name email role isFrozen frozenAt isDeactivated deactivatedAt");

    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json({ message: "User unfrozen", user });
  } catch (err) {
    console.error("UNFREEZE ERROR:", err);
    res.status(500).json({ message: "Failed to unfreeze user" });
  }
});

/**
 * NOTE:
 * - Role changing route intentionally REMOVED (as per your project decision).
 * - If you ever need it back, add a PATCH /:id/role with self-protection.
 */

module.exports = router;
