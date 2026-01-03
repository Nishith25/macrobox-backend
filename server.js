// server.js (CommonJS)

require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const app = express();

// -------------------- CORS CONFIG --------------------
// -------------------- CORS CONFIG --------------------
const corsOptions = {
  origin: [
    "http://localhost:5173",
    "https://macrobox.co.in",
    "https://www.macrobox.co.in",
    "https://macrobox-frontend.vercel.app",
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

// -------------------- MIDDLEWARE (ORDER MATTERS) --------------------
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

// ✅ REQUIRED for JSON bodies
app.use(express.json());

// ✅ REQUIRED for multipart/form-data (multer)
app.use(express.urlencoded({ extended: true }));

// ✅ Cookies for auth / refresh
app.use(cookieParser());

// -------------------- ROUTES --------------------
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/user");
const mealsRoutes = require("./routes/meals");
const adminMealsRoutes = require("./routes/adminMeals");
const adminUsersRoutes = require("./routes/adminUsers");

// -------------------- REGISTER ROUTES --------------------
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/meals", mealsRoutes);
app.use("/api/admin/meals", adminMealsRoutes);
app.use("/api/admin/users", adminUsersRoutes);

// -------------------- TEST ROUTES --------------------
app.get("/", (req, res) => {
  res.send("MacroBox Backend Running 🚀");
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Backend is running successfully 🚀",
  });
});

// -------------------- ERROR HANDLER --------------------
app.use((err, req, res, next) => {
  console.error("Unhandled Error:", err);
  res.status(500).json({ message: "Internal Server Error" });
});

// -------------------- DATABASE CONNECTION --------------------
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => {
    console.error("❌ MongoDB Error:", err);
    process.exit(1);
  });

// -------------------- START SERVER --------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
