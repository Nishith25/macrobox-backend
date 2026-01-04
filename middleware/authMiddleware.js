const jwt = require("jsonwebtoken");
const User = require("../models/User");

// ---------------- VERIFY AUTH ----------------
const verifyAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // Missing header
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Authorization token missing" });
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "Token not provided" });
    }

    // 🔐 VERIFY TOKEN
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ⚠️ IMPORTANT: decoded.id MUST EXIST
    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error("verifyAuth error:", err.message);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

// ---------------- VERIFY ADMIN ----------------
const verifyAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access only" });
  }

  next();
};

module.exports = {
  verifyAuth,
  verifyAdmin,
};
