require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const app = express();

/* ================= MIDDLEWARE FIRST ================= */
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://macrobox.co.in",
      "https://www.macrobox.co.in",
      "https://macrobox-frontend.vercel.app",
    ],
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

/* ================= ROUTES ================= */
app.use("/api/auth", require("./routes/auth"));
app.use("/api/user", require("./routes/user"));
app.use("/api/meals", require("./routes/meals"));
app.use("/api/admin/meals", require("./routes/adminMeals"));
app.use("/api/admin/users", require("./routes/adminUsers"));

/* ✅ ADMIN coupons */
app.use("/api/admin/coupons", require("./routes/adminCoupons"));

/* ✅ USER coupons (apply + available) */
app.use("/api/coupons", require("./routes/coupons"));

app.use("/api/checkout", require("./routes/checkout"));
app.use("/api/orders", require("./routes/orders"));

/* ================= HEALTH ================= */
app.get("/", (req, res) => {
  res.send("MacroBox Backend Running 🚀");
});

/* ================= ERROR HANDLER ================= */
app.use((err, req, res, next) => {
  console.error("Unhandled Error:", err);
  res.status(500).json({ message: "Internal Server Error" });
});

/* ================= DB ================= */
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => {
    console.error("❌ MongoDB Error:", err);
    process.exit(1);
  });

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
