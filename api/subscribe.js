export default function handler(req, res) {
  if (req.method === 'POST') {
    const { email } = req.body;
    // In a real app, save to a DB like Vercel Postgres using `@vercel/postgres`
    // Send email using Resend, Nodemailer, etc.
    // For now, redirect to a success page or return a template response
    res.setHeader('Content-Type', 'text/html');
    res.status(200).end(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Subscribed!</title>
        <link rel="stylesheet" href="/styles.css">
        <style>
          body { display: flex; align-items: center; justify-content: center; height: 100vh; text-align: center; }
        </style>
      </head>
      <body>
        <div>
          <h2>Thank you for subscribing!</h2>
          <p>We've sent a confirmation email to ${email}.</p>
          <a href="/" class="top-newsletter" style="margin-top: 20px;">Back to Mesh</a>
        </div>
      </body>
      </html>
    `);
  } else {
    res.status(405).end('Method Not Allowed');
  }
}
