const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User");
const sendEmail = require("../utils/sendEmail");

const router = express.Router();

// ---------------- TOKEN HELPERS ----------------
const createAccessToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: "15m" });

const createRefreshToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: "7d",
  });

// ---------------- SIGNUP ----------------
router.post("/signup", async (req, res) => {
  try {
    console.log("SIGNUP BODY:", req.body);

    const { name, email, password } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ message: "All fields required" });

    const existing = await User.findOne({ email });
    if (existing)
      return res.status(400).json({ message: "Email already in use" });

    const hashed = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(32).toString("hex");

    await User.create({
      name,
      email,
      password: hashed,
      emailVerified: false,
      verificationToken,
    });

    const link = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;

    const html = `
      <h2>Welcome to MacroBox, ${name}! 🎉</h2>
      <p>Click the button below to verify your email:</p>
      <a href="${link}" style="
        background:#10b981;
        color:white;
        padding:12px 18px;
        border-radius:6px;
        text-decoration:none;
        font-size:16px;">
        Verify Email
      </a>
      <br/><br/>
      <p>If you didn’t create this account, you can safely ignore this email.</p>
    `;

    await sendEmail(email, "Verify Your MacroBox Account", html);

    res.json({
      message: `Signup successful! Verification email sent to ${email}.`,
    });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ---------------- VERIFY EMAIL ----------------
router.get("/verify-email/:token", async (req, res) => {
  try {
    const user = await User.findOne({
      verificationToken: req.params.token,
    });

    if (!user) return res.status(400).json({ message: "Invalid token" });

    user.emailVerified = true;
    user.verificationToken = undefined;
    await user.save();

    res.json({ message: "Email verified successfully" });
  } catch (err) {
    console.error("Verify error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ---------------- LOGIN ----------------
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user)
      return res.status(400).json({ message: "Invalid credentials" });

    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(400).json({ message: "Invalid credentials" });

    if (!user.emailVerified)
      return res.status(403).json({ message: "Please verify your email first" });

    const token = createAccessToken(user._id);
    const refreshToken = createRefreshToken(user._id);

    res.json({
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      token,
      refreshToken,
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ---------------- FORGOT PASSWORD ----------------
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email });

  if (!user)
    return res.json({ message: "Reset link sent if email exists" });

  const token = crypto.randomBytes(32).toString("hex");

  user.resetPasswordToken = token;
  user.resetPasswordExpires = Date.now() + 30 * 60 * 1000;
  await user.save();

  const resetLink = `${process.env.FRONTEND_URL}/reset-password/${token}`;

  const html = `
    <h2>Password Reset Request</h2>
    <p>Click below to reset your password:</p>
    <a href="${resetLink}" style="color:#10b981;font-weight:bold;">Reset Password</a>
    <p>This link expires in 30 minutes.</p>
  `;

  await sendEmail(email, "MacroBox - Password Reset", html);

  res.json({ message: "Reset link sent to email" });
});

// ---------------- RESET PASSWORD ----------------
router.post("/reset-password/:token", async (req, res) => {
  const { password } = req.body;

  try {
    const user = await User.findOne({
      resetPasswordToken: req.params.token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user)
      return res.status(400).json({ message: "Invalid or expired token" });

    const hashed = await bcrypt.hash(password, 10);

    user.password = hashed;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    res.json({ message: "Password reset successfully!" });
  } catch (err) {
    console.error("Reset error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
