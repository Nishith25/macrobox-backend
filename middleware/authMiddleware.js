const jwt = require("jsonwebtoken");
const User = require("../models/User");

// ---------------- VERIFY AUTH (JWT ACCESS TOKEN) ----------------
const verifyAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // ❌ No Authorization header
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Authorization token missing" });
    }

    const token = authHeader.split(" ")[1];

    // ❌ No token extracted
    if (!token) {
      return res.status(401).json({ message: "Token not provided" });
    }

    // ✅ Verify access token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ✅ Fetch user (exclude password)
    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (err) {
    console.error("verifyAuth error:", err.message);

    // Token expired or invalid
    return res.status(401).json({
      message: "Invalid or expired token",
    });
  }
};

// ---------------- VERIFY ADMIN ROLE ----------------
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
