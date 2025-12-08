// server.js (CommonJS)

const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");

// Load env variables
dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// -------------------- ROUTES --------------------
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/user");
const mealsRoutes = require("./routes/meals");
const adminMealsRoutes = require("./routes/adminMeals");
const adminUsersRoutes = require("./routes/adminUsers"); // ✅ NEW

// -------------------- REGISTER ROUTES --------------------
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/meals", mealsRoutes);
app.use("/api/admin/meals", adminMealsRoutes);
app.use("/api/admin/users", adminUsersRoutes); // ✅ NEW admin user management

// Test Route
app.get("/", (req, res) => {
  res.send("MacroBox Backend Running 🚀");
});

// -------------------- DATABASE CONNECTION --------------------
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("❌ MongoDB Error:", err));

// -------------------- START SERVER --------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
