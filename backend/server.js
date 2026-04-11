require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const PDFDocument = require('pdfkit');
const nodemailer = require('nodemailer');

const app = express();

app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

app.use(cors({ origin: '*' }));

// Secure Backend Catalog: The source of truth for prices (in INR)
const PRODUCTS = {
    "routine": { name: "Kerabeaute Routine", price: 1599 },
    "radiante-elixir": { name: "Radiante Elixir", price: 699 },
    "prolog": { name: "Prolog Shampoo", price: 499 },
    "kerabeaute-roll-on": { name: "Kerabeaute Roll-on", price: 399 }
};

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_123456789',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'secret_123456789'
});

// Configure NodeMailer Transport
const transporter = nodemailer.createTransport({
    service: 'gmail', // You can use other services (SendGrid, Mailgun) by changing SMTP settings
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

app.post('/create-order', async (req, res) => {
  try {
    const { items, customerEmail } = req.body; 

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Invalid cart items" });
    }

    let totalAmount = 0;
    // Map items to a minimized structure for notes (due to 254 char limit)
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

    const options = {
      amount: totalAmount * 100, // Amount in paise
      currency: "INR",
      receipt: "receipt_" + Math.random().toString(36).substring(7),
      notes: {
        // Store stringified items for the webhook to parse later
        cart: JSON.stringify(storedItems)
      }
    };

    const order = await razorpay.orders.create(options);
    
    res.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency
    });

  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    res.status(500).json({ error: "Failed to create order" });
  }
});

// Helper Function: Generate PDF Buffer
function createInvoicePDF(paymentDetails, cartItems) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 50 });
            const buffers = [];
            
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            
            // Header
            doc.fontSize(20).fillColor('#109fa2').text('KERABEAUTE', { align: 'center' });
            doc.moveDown(0.5);
            doc.fontSize(10).fillColor('#555555').text('Tax Invoice / Receipt', { align: 'center' });
            doc.moveDown(2);
            
            // Order Info
            doc.fontSize(12).fillColor('#000000').text(`Order ID: ${paymentDetails.order_id}`);
            doc.text(`Payment ID: ${paymentDetails.id}`);
            doc.text(`Date: ${new Date().toLocaleDateString()}`);
            doc.moveDown(2);
            
            // Table Header
            const tableTop = doc.y;
            doc.font('Helvetica-Bold');
            doc.text('Item', 50, tableTop);
            doc.text('Quantity', 300, tableTop);
            doc.text('Price (INR)', 400, tableTop, { width: 90, align: 'right' });
            doc.moveTo(50, tableTop + 15).lineTo(500, tableTop + 15).stroke();
            doc.font('Helvetica');
            
            // Table Rows
            let y = tableTop + 25;
            let total = 0;
            
            for (let item of cartItems) {
                const product = PRODUCTS[item.id] || { name: 'Unknown Item', price: 0 };
                const subtotal = product.price * item.q;
                total += subtotal;
                
                doc.text(product.name, 50, y);
                doc.text(item.q.toString(), 300, y);
                doc.text(`Rs. ${subtotal.toFixed(2)}`, 400, y, { width: 90, align: 'right' });
                y += 20;
            }
            
            doc.moveTo(50, y).lineTo(500, y).stroke();
            y += 15;
            
            // Total
            doc.font('Helvetica-Bold');
            doc.text('Total Paid:', 300, y);
            doc.text(`Rs. ${total.toFixed(2)}`, 400, y, { width: 90, align: 'right' });
            
            // Footer
            doc.moveDown(4);
            doc.font('Helvetica').fontSize(10).fillColor('#888888').text('Thank you for shopping with Kerabeaute!', 50, doc.y, { align: 'center' });
            
            doc.end();
        } catch (err) {
            reject(err);
        }
    });
}

app.post('/webhook', async (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || 'webhook_secret';
  const signature = req.headers['x-razorpay-signature'];
  
  if (!signature) {
      return res.status(400).send('No signature passed');
  }

  try {
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(req.rawBody)
        .digest('hex');
  
      if (expectedSignature === signature) {
        
        const eventContext = req.body;

        // Process only payment.captured event
        if (eventContext.event === 'payment.captured') {
            console.log("Payment successfully captured!");
            
            const paymentDetails = eventContext.payload.payment.entity;
            const customerEmail = paymentDetails.email;
            
            // Parse notes to get items
            let cartItems = [];
            if (paymentDetails.notes && paymentDetails.notes.cart) {
                try {
                    cartItems = JSON.parse(paymentDetails.notes.cart);
                } catch(e) {
                    console.error("Failed to parse cart note:", e);
                }
            }

            if (customerEmail && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
                try {
                    // Generate PDF
                    const pdfBuffer = await createInvoicePDF(paymentDetails, cartItems);

                    // Send Email
                    await transporter.sendMail({
                        from: `"Kerabeaute Shop" <${process.env.EMAIL_USER}>`,
                        to: customerEmail,
                        subject: `Your Kerabeaute Invoice for Order ${paymentDetails.order_id}`,
                        text: `Thank you for your purchase! Please find your invoice attached.`,
                        attachments: [
                            {
                                filename: `Invoice_${paymentDetails.order_id}.pdf`,
                                content: pdfBuffer
                            }
                        ]
                    });
                    console.log(`Invoice emailed successfully to ${customerEmail}`);
                } catch (emailErr) {
                    console.error("Failed to generate/send invoice:", emailErr);
                }
            } else {
                console.log("Missing customer email or EMAIL credentials, skipping invoice dispatch.");
            }
        }

        return res.status(200).send('OK');
      } else {
        return res.status(400).send('Invalid signature');
      }
  } catch(error) {
     console.error("Webhook error: ", error);
     return res.status(500).send('Server Error');
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`Razorpay Backend running on port ${PORT}`);
});
