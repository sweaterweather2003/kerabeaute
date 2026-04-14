require('dotenv').config();
const express = require('express');
const Razorpay = require('razorpay');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

app.post('/create-razorpay-order', async (req, res) => {
  try {
    const { amount } = req.body;

    const options = {
      amount: Math.round(amount * 100),   // paise
      currency: "INR",
      receipt: `kb_${Date.now()}`,
      payment_capture: 1,
    };

    const order = await razorpay.orders.create(options);
    res.json({ success: true, order });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.error?.description || "Server error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));