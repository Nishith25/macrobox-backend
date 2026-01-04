const express = require("express");
const crypto = require("crypto");
const razorpay = require("../lib/razorpay");
const { verifyAuth } = require("../middleware/auth");
const Order = require("../models/Order");
const Coupon = require("../models/Coupon");

const router = express.Router();

/* =========================
   USER: LIST MY ORDERS
   GET /api/orders
========================= */
router.get("/", verifyAuth, async (req, res) => {
  const orders = await Order.find({ user: req.user._id })
    .sort({ createdAt: -1 })
    .limit(50);

  res.json(orders);
});

/* =========================
   CREATE RAZORPAY ORDER (SERVER)
   POST /api/orders/create
========================= */
router.post("/create", verifyAuth, async (req, res) => {
  try {
    const { cart, couponCode, discount, delivery } = req.body;

    if (!Array.isArray(cart) || cart.length === 0) {
      return res.status(400).json({ message: "Cart is empty" });
    }

    const subtotal = cart.reduce((sum, i) => sum + Number(i.price) * Number(i.qty), 0);
    const totalProtein = cart.reduce((sum, i) => sum + Number(i.protein) * Number(i.qty), 0);
    const totalCalories = cart.reduce((sum, i) => sum + Number(i.calories) * Number(i.qty), 0);

    const discountNum = Math.min(Number(discount || 0), subtotal);
    const payable = Math.max(subtotal - discountNum, 1);

    const rpOrder = await razorpay.orders.create({
      amount: payable * 100,
      currency: "INR",
      receipt: `rcpt_${Date.now()}`,
    });

    const order = await Order.create({
      user: req.user._id,
      items: cart.map((i) => ({
        meal: i._id,
        title: i.title,
        price: i.price,
        protein: i.protein,
        calories: i.calories,
        qty: i.qty,
      })),
      totals: {
        subtotal,
        discount: discountNum,
        payable,
        totalProtein,
        totalCalories,
      },
      coupon: couponCode
        ? { code: String(couponCode).toUpperCase(), discount: discountNum }
        : undefined,
      delivery,
      payment: {
        status: "created",
        razorpayOrderId: rpOrder.id,
      },
    });

    res.json({
      orderId: order._id,
      razorpayOrderId: rpOrder.id,
      amount: payable * 100,
      currency: "INR",
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error("Create order error:", err);
    res.status(500).json({ message: "Failed to create order" });
  }
});

/* =========================
   VERIFY PAYMENT (SERVER)
   POST /api/orders/verify
========================= */
router.post("/verify", verifyAuth, async (req, res) => {
  try {
    const { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expected !== razorpay_signature) {
      order.payment.status = "failed";
      await order.save();
      return res.status(400).json({ message: "Payment verification failed" });
    }

    // mark paid
    order.payment.status = "paid";
    order.payment.razorpayOrderId = razorpay_order_id;
    order.payment.razorpayPaymentId = razorpay_payment_id;
    order.payment.razorpaySignature = razorpay_signature;
    await order.save();

    // coupon consume (after successful pay)
    if (order.coupon?.code) {
      const coupon = await Coupon.findOne({ code: order.coupon.code });
      if (coupon) {
        // total usage
        coupon.usedCount += 1;

        // per user usage
        const idx = coupon.usedBy.findIndex((u) => u.user.toString() === req.user._id.toString());
        if (idx >= 0) coupon.usedBy[idx].count += 1;
        else coupon.usedBy.push({ user: req.user._id, count: 1 });

        await coupon.save();
      }
    }

    res.json({ message: "Payment verified", order });
  } catch (err) {
    console.error("Verify error:", err);
    res.status(500).json({ message: "Verification failed" });
  }
});

module.exports = router;
