const { setGlobalOptions, defineSecret } = require("firebase-functions");
const { onRequest } = require("firebase-functions/https");
const express = require("express");
const cors = require("cors");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const PDFDocument = require("pdfkit");
const nodemailer = require("nodemailer");

// ─── Define Secrets (set via: firebase functions:secrets:set SECRET_NAME) ────
const RAZORPAY_KEY_ID = defineSecret("RAZORPAY_KEY_ID");
const RAZORPAY_KEY_SECRET = defineSecret("RAZORPAY_KEY_SECRET");
const RAZORPAY_WEBHOOK_SECRET = defineSecret("RAZORPAY_WEBHOOK_SECRET");
const EMAIL_USER = defineSecret("EMAIL_USER");
const EMAIL_PASS = defineSecret("EMAIL_PASS");

// ─── Cost control ─────────────────────────────────────────────────────────────
setGlobalOptions({ maxInstances: 10 });

// ─── Product Catalog (source of truth for prices in INR) ─────────────────────
const PRODUCTS = {
  "routine":           { name: "Kerabeaute Routine",   price: 1599 },
  "radiante-elixir":   { name: "Radiante Elixir",       price: 699  },
  "prolog":            { name: "Prolog Shampoo",         price: 499  },
  "kerabeaute-roll-on":{ name: "Kerabeaute Roll-on",    price: 399  },
};

// ─── Express App ──────────────────────────────────────────────────────────────
const app = express();

// Parse raw body (needed for Razorpay webhook signature verification)
app.use(express.json({
  verify: (req, _res, buf) => { req.rawBody = buf; },
}));

app.use(cors({ origin: "*" }));

// ─── POST /create-order ───────────────────────────────────────────────────────
app.post("/create-order", async (req, res) => {
  try {
    const { items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Invalid cart items" });
    }

    let totalAmount = 0;
    const storedItems = [];

    for (const item of items) {
      const product = PRODUCTS[item.id];
      if (product) {
        const qty = item.quantity || 1;
        totalAmount += product.price * qty;
        storedItems.push({ id: item.id, q: qty });
      }
    }

    if (totalAmount <= 0) {
      return res.status(400).json({ error: "Total amount must be greater than 0" });
    }

    // Build Razorpay client using the runtime secret values
    const razorpay = new Razorpay({
      key_id:     RAZORPAY_KEY_ID.value(),
      key_secret: RAZORPAY_KEY_SECRET.value(),
    });

    const options = {
      amount:   totalAmount * 100, // paise
      currency: "INR",
      receipt:  "receipt_" + Math.random().toString(36).substring(7),
      notes: {
        cart: JSON.stringify(storedItems),
      },
    };

    const order = await razorpay.orders.create(options);

    return res.json({
      order_id: order.id,
      amount:   order.amount,
      currency: order.currency,
    });

  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    return res.status(500).json({ error: "Failed to create order" });
  }
});

// ─── Helper: Generate PDF Invoice Buffer ──────────────────────────────────────
function createInvoicePDF(paymentDetails, cartItems) {
  return new Promise((resolve, reject) => {
    try {
      const doc     = new PDFDocument({ margin: 50 });
      const buffers = [];

      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end",  ()      => resolve(Buffer.concat(buffers)));

      // Header
      doc.fontSize(20).fillColor("#109fa2").text("KERABEAUTE", { align: "center" });
      doc.moveDown(0.5);
      doc.fontSize(10).fillColor("#555555").text("Tax Invoice / Receipt", { align: "center" });
      doc.moveDown(2);

      // Order Info
      doc.fontSize(12).fillColor("#000000").text(`Order ID: ${paymentDetails.order_id}`);
      doc.text(`Payment ID: ${paymentDetails.id}`);
      doc.text(`Date: ${new Date().toLocaleDateString()}`);
      doc.moveDown(2);

      // Table Header
      const tableTop = doc.y;
      doc.font("Helvetica-Bold");
      doc.text("Item",         50,  tableTop);
      doc.text("Quantity",     300, tableTop);
      doc.text("Price (INR)", 400, tableTop, { width: 90, align: "right" });
      doc.moveTo(50, tableTop + 15).lineTo(500, tableTop + 15).stroke();
      doc.font("Helvetica");

      // Table Rows
      let y     = tableTop + 25;
      let total = 0;

      for (const item of cartItems) {
        const product  = PRODUCTS[item.id] || { name: "Unknown Item", price: 0 };
        const subtotal = product.price * item.q;
        total += subtotal;

        doc.text(product.name,             50,  y);
        doc.text(item.q.toString(),        300, y);
        doc.text(`Rs. ${subtotal.toFixed(2)}`, 400, y, { width: 90, align: "right" });
        y += 20;
      }

      doc.moveTo(50, y).lineTo(500, y).stroke();
      y += 15;

      // Total
      doc.font("Helvetica-Bold");
      doc.text("Total Paid:", 300, y);
      doc.text(`Rs. ${total.toFixed(2)}`, 400, y, { width: 90, align: "right" });

      // Footer
      doc.moveDown(4);
      doc.font("Helvetica").fontSize(10).fillColor("#888888")
        .text("Thank you for shopping with Kerabeaute!", 50, doc.y, { align: "center" });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// ─── POST /webhook ────────────────────────────────────────────────────────────
app.post("/webhook", async (req, res) => {
  const secret    = RAZORPAY_WEBHOOK_SECRET.value();
  const signature = req.headers["x-razorpay-signature"];

  if (!signature) {
    return res.status(400).send("No signature passed");
  }

  try {
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(req.rawBody)
      .digest("hex");

    if (expectedSignature !== signature) {
      return res.status(400).send("Invalid signature");
    }

    const eventContext = req.body;

    if (eventContext.event === "payment.captured") {
      console.log("Payment successfully captured!");

      const paymentDetails = eventContext.payload.payment.entity;
      const customerEmail  = paymentDetails.email;

      // Parse cart from Razorpay order notes
      let cartItems = [];
      if (paymentDetails.notes && paymentDetails.notes.cart) {
        try {
          cartItems = JSON.parse(paymentDetails.notes.cart);
        } catch (e) {
          console.error("Failed to parse cart note:", e);
        }
      }

      // Send invoice email if we have credentials
      const emailUser = EMAIL_USER.value();
      const emailPass = EMAIL_PASS.value();

      if (customerEmail && emailUser && emailPass) {
        try {
          const pdfBuffer   = await createInvoicePDF(paymentDetails, cartItems);
          const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: { user: emailUser, pass: emailPass },
          });

          await transporter.sendMail({
            from:        `"Kerabeaute Shop" <${emailUser}>`,
            to:          customerEmail,
            subject:     `Your Kerabeaute Invoice for Order ${paymentDetails.order_id}`,
            text:        "Thank you for your purchase! Please find your invoice attached.",
            attachments: [{
              filename: `Invoice_${paymentDetails.order_id}.pdf`,
              content:  pdfBuffer,
            }],
          });

          console.log(`Invoice emailed to ${customerEmail}`);
        } catch (emailErr) {
          console.error("Failed to send invoice:", emailErr);
        }
      } else {
        console.log("Missing email credentials or customer email — skipping invoice.");
      }
    }

    return res.status(200).send("OK");

  } catch (error) {
    console.error("Webhook error:", error);
    return res.status(500).send("Server Error");
  }
});

// ─── Export as Firebase Cloud Function ───────────────────────────────────────
// All secrets must be listed here so Firebase injects them at runtime
exports.api = onRequest(
  {
    secrets: [
      RAZORPAY_KEY_ID,
      RAZORPAY_KEY_SECRET,
      RAZORPAY_WEBHOOK_SECRET,
      EMAIL_USER,
      EMAIL_PASS,
    ],
  },
  app
);
