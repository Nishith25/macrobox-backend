// backend/routes/auth.js
// MacroBox Auth Routes – FINAL (Hardened, Production-safe)

const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User");
const sendEmail = require("../utils/sendEmail");

const router = express.Router();

/* =====================================================
   TOKEN HELPERS
===================================================== */

const createAccessToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: "30m" });

const createRefreshToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET, { expiresIn: "7d" });

/* =====================================================
   HELPERS
===================================================== */

// ✅ Prevent enum validation crash (null is NOT allowed for enum)
const cleanBodyMetrics = (bm) => {
  if (!bm || typeof bm !== "object") return undefined;

  const copy = { ...bm };

  if (copy.gender == null || copy.gender === "") delete copy.gender;
  if (copy.activity == null || copy.activity === "") delete copy.activity;

  return copy;
};

/* =====================================================
   SIGNUP
===================================================== */
router.post("/signup", async (req, res) => {
  try {
    const { name, email, password, bodyMetrics } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields are required." });
    }

    const existing = await User.findOne({ email });

    // ❌ Active user → block signup
    if (existing && !existing.isDeactivated) {
      return res
        .status(400)
        .json({ message: "Email already in use. Please login instead." });
    }

    const hashed = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(32).toString("hex");

    /* ---------- REACTIVATE DEACTIVATED USER ---------- */
    if (existing && existing.isDeactivated) {
      existing.name = name;
      existing.password = hashed;

      existing.isDeactivated = false;
      existing.deactivatedAt = null;

      existing.isFrozen = false;
      existing.frozenAt = null;

      existing.emailVerified = false;
      existing.verificationToken = verificationToken;

      existing.resetPasswordToken = null;
      existing.resetPasswordExpires = null;

      existing.bodyMetrics = cleanBodyMetrics(bodyMetrics);

      await existing.save();

      // Email should NOT crash signup
      try {
        if (process.env.FRONTEND_URL) {
          const link = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;
          await sendEmail(
            email,
            "Verify your MacroBox account",
            `
              <h2>Welcome back to MacroBox, ${name}! 🎉</h2>
              <p>Your account was reactivated. Please verify your email:</p>
              <a href="${link}"
                 style="background:#22c55e;padding:12px 20px;color:white;
                 border-radius:6px;text-decoration:none;font-weight:bold;">
                Verify Email
              </a>
            `
          );
        }
      } catch (err) {
        console.error("⚠️ Reactivation email failed:", err);
      }

      return res.json({
        message:
          "Account reactivated! Please check your email to verify your account.",
      });
    }

    /* ---------- FRESH SIGNUP ---------- */
    const newUser = await User.create({
      name,
      email,
      password: hashed,
      emailVerified: false,
      verificationToken,
      bodyMetrics: cleanBodyMetrics(bodyMetrics),
    });

    try {
      if (process.env.FRONTEND_URL) {
        const link = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;
        await sendEmail(
          email,
          "Verify your MacroBox account",
          `
            <h2>Welcome to MacroBox, ${name}! 🎉</h2>
            <p>Click below to verify your email:</p>
            <a href="${link}"
               style="background:#22c55e;padding:12px 20px;color:white;
               border-radius:6px;text-decoration:none;font-weight:bold;">
              Verify Email
            </a>
          `
        );
      }
    } catch (err) {
      console.error("⚠️ Signup verification email failed:", err);
    }

    return res.status(201).json({
      message:
        "Signup successful! Please check your email to verify your account.",
      userId: newUser._id,
    });
  } catch (err) {
    console.error("❌ Signup error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/* =====================================================
   VERIFY EMAIL
===================================================== */
router.get("/verify-email/:token", async (req, res) => {
  try {
    const user = await User.findOne({ verificationToken: req.params.token });
    if (!user) return res.status(400).json({ message: "Invalid token" });

    user.emailVerified = true;
    user.verificationToken = undefined;
    await user.save();

    res.json({ message: "Email verified successfully" });
  } catch (err) {
    console.error("❌ Verify email error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* =====================================================
   LOGIN
===================================================== */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not registered." });

    if (user.isFrozen) {
      return res.status(403).json({
        message:
          "Your account is freezed. Contact customer support to unfreeze it.",
      });
    }

    if (user.isDeactivated) {
      return res.status(403).json({
        message:
          "Your account is deactivated. Please sign up again to reactivate.",
      });
    }

    if (!user.emailVerified) {
      return res.status(403).json({ message: "Please verify your email." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ message: "Incorrect password." });

    if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
      console.error("❌ JWT env missing");
      return res.status(500).json({ message: "Server configuration error" });
    }

    const accessToken = createAccessToken(user._id);
    const refreshToken = createRefreshToken(user._id);

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/api/auth/refresh",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      token: accessToken,
    });
  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* =====================================================
   REFRESH TOKEN
===================================================== */
router.post("/refresh", async (req, res) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) return res.status(401).json({ message: "No refresh token" });

    jwt.verify(token, process.env.JWT_REFRESH_SECRET, (err, decoded) => {
      if (err) return res.status(403).json({ message: "Invalid refresh token" });
      res.json({ token: createAccessToken(decoded.id) });
    });
  } catch (err) {
    console.error("❌ Refresh error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* =====================================================
   LOGOUT
===================================================== */
router.post("/logout", (req, res) => {
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/api/auth/refresh",
  });

  res.json({ message: "Logged out successfully" });
});

/* =====================================================
   FORGOT PASSWORD
===================================================== */
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.json({ message: "Reset link sent if email exists" });

    const token = crypto.randomBytes(32).toString("hex");
    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 30 * 60 * 1000;
    await user.save();

    try {
      if (process.env.FRONTEND_URL) {
        const resetLink = `${process.env.FRONTEND_URL}/reset-password/${token}`;
        await sendEmail(
          email,
          "MacroBox - Password Reset",
          `
            <h2>Password Reset</h2>
            <a href="${resetLink}" style="color:#10b981;font-weight:bold;">
              Reset Password
            </a>
            <p>This link expires in 30 minutes.</p>
          `
        );
      }
    } catch (err) {
      console.error("⚠️ Forgot password email failed:", err);
    }

    res.json({ message: "Reset link sent to email" });
  } catch (err) {
    console.error("❌ Forgot password error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* =====================================================
   RESET PASSWORD
===================================================== */
router.post("/reset-password/:token", async (req, res) => {
  try {
    const user = await User.findOne({
      resetPasswordToken: req.params.token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user)
      return res.status(400).json({ message: "Invalid or expired token" });

    if (!req.body.password)
      return res.status(400).json({ message: "Password is required" });

    user.password = await bcrypt.hash(req.body.password, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: "Password reset successfully!" });
  } catch (err) {
    console.error("❌ Reset password error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* =====================================================
   RESEND VERIFICATION
===================================================== */
router.post("/resend-verification", async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) return res.status(400).json({ message: "User not found" });

    if (user.isFrozen || user.isDeactivated) {
      return res.status(403).json({
        message: "Account not active. Contact support.",
      });
    }

    if (user.emailVerified)
      return res.status(400).json({ message: "Email already verified" });

    const newToken = crypto.randomBytes(32).toString("hex");
    user.verificationToken = newToken;
    await user.save();

    try {
      if (process.env.FRONTEND_URL) {
        const link = `${process.env.FRONTEND_URL}/verify-email/${newToken}`;
        await sendEmail(
          email,
          "Verify your MacroBox account",
          `
            <h2>Email Verification</h2>
            <a href="${link}"
               style="background:#22c55e;padding:10px 18px;color:white;
               border-radius:6px;text-decoration:none;font-weight:bold;">
              Verify Email
            </a>
          `
        );
      }
    } catch (err) {
      console.error("⚠️ Resend verification email failed:", err);
    }

    res.json({ message: "Verification email resent!" });
  } catch (err) {
    console.error("❌ Resend verification error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
