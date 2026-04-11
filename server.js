const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

app.use(express.static(path.join(__dirname, 'public')));

function sendPage(res, fileName) {
  const filePath = path.join(__dirname, 'public', fileName);
  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }
  return res.status(404).send(get404Page());
}

function get404Page() {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>404 - Page Not Found | Kerabeaute</title>
      <style>
        body { font-family: 'Cabin', sans-serif; text-align: center; padding: 100px 20px; background: #fff; color: #333; }
        h1 { color: #2d5a2d; font-size: 3.5rem; margin-bottom: 1rem; }
        p { font-size: 1.3rem; color: #555; margin: 1.5rem 0; }
        a { color: #28a745; text-decoration: none; font-weight: bold; }
        a:hover { text-decoration: underline; }
      </style>
    </head>
    <body>
      <h1>Oops! Page not found.</h1>
      <p>Sorry, we couldn't find what you're looking for.</p>
      <p><a href="/">← Return to Home</a></p>
    </body>
    </html>
  `;
}

// Main routes
app.get('/', (req, res) => sendPage(res, 'index.html'));

app.get(['/shop', '/get-it-now', '/products'], (req, res) => sendPage(res, 'get-it-now.html'));
app.get(['/get-it-now/', '/get-it-now', '/products/'], (req, res) => res.redirect(301, '/get-it-now'));

app.get(['/about', '/about-us'], (req, res) => sendPage(res, 'about-us.html'));
app.get(['/about/', '/about-us/'], (req, res) => res.redirect(301, '/about-us'));

app.get('/blogs',       (req, res) => sendPage(res, 'blogs.html'));
app.get('/brochure',    (req, res) => sendPage(res, 'brochure.html'));
app.get('/connect',     (req, res) => sendPage(res, 'connect.html'));
app.get('/join-us',     (req, res) => sendPage(res, 'join-us.html'));
app.get('/testimonials',(req, res) => sendPage(res, 'testimonials.html'));

app.get('/cart',        (req, res) => sendPage(res, 'cart.html'));
app.get('/checkout',    (req, res) => sendPage(res, 'checkout.html'));
app.get('/my-account',  (req, res) => sendPage(res, 'my-account.html'));

// Product pages - Fixed (this is the important part)
app.get('/product/:slug', (req, res) => {
  const slug = req.params.slug.toLowerCase().trim();
  sendPage(res, `${slug}.html`);
});

app.get('/product/:slug/', (req, res) => {
  res.redirect(301, `/product/${req.params.slug}`);
});

// Catch-all for direct slugs (routine, kerabeaute-roll-on, etc.)
app.get('/:slug', (req, res, next) => {
  const slug = req.params.slug.toLowerCase();
  const filePath = path.join(__dirname, 'public', `${slug}.html`);

  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }
  next();
});

// Final 404
app.use((req, res) => {
  res.status(404).send(get404Page());
});

app.listen(PORT, () => {
  console.log(`Kerabeaute running at http://localhost:${PORT}`);
});