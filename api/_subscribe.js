import crypto from 'node:crypto';
import { FieldValue, Timestamp } from '@google-cloud/firestore';
import { Resend } from 'resend';
import { getFirestoreClient } from './_firestore.js';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

function buildConfirmationEmail(email, firstName, lastName) {
  const name = firstName ? firstName.toUpperCase() : 'DEVELOPER';
  return {
    subject: `ACCESS GRANTED: ${name} // MESH WAITLIST`,
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <!-- Force the email to ignore the recipient's system color scheme. Without these
       Gmail/Apple Mail auto-inverts our dark theme in light-mode and breaks the
       design entirely. We keep the dark look for everyone. -->
  <meta name="color-scheme" content="dark only">
  <meta name="supported-color-schemes" content="dark only">
  <title>Mesh Access Confirmed</title>
  <style>
    :root { color-scheme: dark only; }

    @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@1,900&family=DM+Sans:wght@400;500&family=Geist+Mono:wght@400;600&display=swap');

    /* Belt + suspenders against client dark-mode inversion. Gmail respects
       data-ogsc attributes; iOS Mail honours media query. */
    @media (prefers-color-scheme: light) {
      :root, body, .email-wrapper { background-color: #020406 !important; color: #ffffff !important; }
    }
    [data-ogsc] body, [data-ogsb] body { background-color: #020406 !important; color: #ffffff !important; }

    body {
      margin: 0; padding: 0; background-color: #020406;
      font-family: 'DM Sans', -apple-system, sans-serif;
      -webkit-font-smoothing: antialiased; color: #ffffff;
    }

    /* Outer Container */
    .email-wrapper {
      width: 100%; background-color: #020406;
      background-image: 
        radial-gradient(circle at 10% 10%, rgba(0, 212, 232, 0.08) 0%, transparent 40%),
        radial-gradient(circle at 90% 80%, rgba(0, 212, 232, 0.05) 0%, transparent 40%);
      padding: 80px 20px;
    }

    .container {
      max-width: 600px; margin: 0 auto;
    }

    /* Brand Header */
    .brand-hero {
      text-align: center; margin-bottom: 80px;
    }
    .brand-wordmark {
      font-family: 'Barlow Condensed', sans-serif;
      font-style: italic; font-weight: 900;
      font-size: 150px; line-height: 0.75;
      letter-spacing: -0.06em; color: #ffffff;
      text-transform: uppercase; margin: 0;
      display: inline-block;
      filter: drop-shadow(0 0 20px rgba(255,255,255,0.05));
    }
    .brand-tagline {
      font-family: 'Geist Mono', monospace;
      font-size: 10px; letter-spacing: 0.4em;
      text-transform: uppercase; color: #00d4e8;
      margin-top: 24px; opacity: 0.8;
    }

    /* Terminal Component */
    .terminal {
      background: #060c12;
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 16px; overflow: hidden;
      box-shadow: 0 50px 100px rgba(0,0,0,0.8), 0 0 40px rgba(0, 212, 232, 0.03);
      margin-bottom: 60px;
    }
    .terminal-bar {
      background: rgba(255, 255, 255, 0.02);
      padding: 14px 24px; border-bottom: 1px solid rgba(255, 255, 255, 0.03);
      display: flex; align-items: center; justify-content: space-between;
    }
    .terminal-dots { display: flex; gap: 8px; }
    .dot { width: 10px; height: 10px; border-radius: 50%; }
    .terminal-title {
      font-family: 'Geist Mono', monospace; font-size: 9px;
      color: rgba(255, 255, 255, 0.2); text-transform: uppercase; letter-spacing: 0.2em;
    }
    .terminal-body {
      padding: 40px; font-family: 'Geist Mono', 'Courier New', monospace; font-size: 13px; line-height: 1.8;
    }
    .ascii-logo {
      color: #00d4e8;
      font-family: 'Courier New', Courier, monospace;
      font-size: 13px;
      line-height: 1;
      letter-spacing: 0;
      white-space: pre;
      margin: 0 0 24px 0;
      display: block;
      font-weight: bold;
    }
    .line { margin-bottom: 6px; }
    .cyan { color: #00d4e8; }
    .muted { color: rgba(255,255,255,0.25); }
    .white { color: #ffffff; }
    .green { color: #28c840; }

    /* Action Block */
    .action-block { text-align: center; padding: 0 40px; }
    .greeting {
      font-family: 'Barlow Condensed', sans-serif; font-style: italic; font-weight: 900;
      font-size: 56px; line-height: 0.9; color: #ffffff; text-transform: uppercase;
      margin-bottom: 20px;
    }
    .description {
      font-size: 17px; line-height: 1.6; color: rgba(255,255,255,0.4);
      margin-bottom: 40px; max-width: 420px; margin-left: auto; margin-right: auto;
    }

    .cta-btn {
      display: inline-block;
      background: #ffffff;
      color: #000000;
      font-family: 'Geist Mono', monospace;
      font-size: 12px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.1em; text-decoration: none;
      padding: 20px 48px; border-radius: 2px;
      transition: all 0.3s;
    }

    /* Footer */
    .footer {
      margin-top: 100px; text-align: center;
      padding-top: 50px; border-top: 1px solid rgba(255,255,255,0.03);
    }
    .footer-text {
      font-family: 'Geist Mono', monospace; font-size: 9px;
      color: rgba(255,255,255,0.15); text-transform: uppercase; letter-spacing: 0.2em;
    }
    .footer-links { margin-top: 16px; }
    .footer-links a { color: rgba(255, 255, 255, 0.3); text-decoration: none; margin: 0 15px; font-size: 9px; }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="container">
      
      <!-- HEADER -->
      <div class="brand-hero">
        <h1 class="brand-wordmark">MESH</h1>
        <div class="brand-tagline">CONTEXT &nbsp;·&nbsp; ENGINE &nbsp;·&nbsp; ACCESS</div>
      </div>

      <!-- TERMINAL WINDOW -->
      <div class="terminal">
        <div class="terminal-bar">
          <div class="terminal-dots">
            <div class="dot" style="background: rgba(255,255,255,0.05);"></div>
            <div class="dot" style="background: rgba(255,255,255,0.05);"></div>
            <div class="dot" style="background: rgba(255,255,255,0.05);"></div>
          </div>
          <div class="terminal-title">mesh/auth-verify</div>
        </div>
        <div class="terminal-body">
<pre class="ascii-logo">
<span style="color: #c678dd;">&lsaquo; </span>███╗   ███╗███████╗███████╗██╗  ██╗
<span style="color: #c678dd;">&lsaquo; </span>████╗ ████║██╔════╝██╔════╝██║  ██║
<span style="color: #c678dd;">&lsaquo; </span>██╔████╔██║█████╗  ███████╗███████║
<span style="color: #c678dd;">&lsaquo; </span>██║╚██╔╝██║██╔══╝  ╚════██║██╔══██║
<span style="color: #c678dd;">&lsaquo; </span>██║ ╚═╝ ██║███████╗███████║██║  ██║
<span style="color: #c678dd;">&lsaquo; </span>╚═╝     ╚═╝╚══════╝╚══════╝╚═╝  ╚═╝ <span style="color: #c678dd;">&rsaquo;</span></pre>
          <div class="line"><span class="cyan">user:</span> <span class="white">${email}</span></div>
          <div class="line"><span class="cyan">node:</span> <span class="white">global-cluster-01</span></div>
          <div class="line"><span class="cyan">status:</span> <span class="green">EARLY_ACCESS_GRANTED</span></div>
          <div class="line"><span class="muted">----------------------------</span></div>
          <div class="line"><span class="muted">$</span> <span class="white">mesh init --waitlist</span></div>
          <div class="line"><span class="muted">probing workspace context...</span> <span class="cyan">DONE</span></div>
          <div class="line"><span class="muted">mounting capsule...</span> <span class="cyan">DONE</span></div>
        </div>
      </div>

      <!-- GREETING -->
      <div class="action-block">
        <h2 class="greeting">Access<br><span style="color: #00d4e8;">Granted.</span></h2>
        <p class="description">
          We've secured your position in the cluster. You'll receive a direct link to the engine as soon as we scale.
        </p>
        <a href="https://try-mesh.com" class="cta-btn">Enter Workspace &rarr;</a>
      </div>

      <!-- FOOTER -->
      <div class="footer">
        <div class="footer-text">Mesh Intelligence &copy; 2026 // Stateless Architecture</div>
        <div class="footer-links">
          <a href="https://try-mesh.com">Main</a>
          <a href="https://github.com/dreddi-edit/homebrew-mesh">GitHub</a>
          <a href="#">Status</a>
        </div>
      </div>

    </div>
  </div>
</body>
</html>`
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'Method Not Allowed' });
  }

  const email = String(req.body?.email || '').trim().toLowerCase();
  const firstName = String(req.body?.firstName || '').trim().slice(0, 80);
  const lastName = String(req.body?.lastName || '').trim().slice(0, 80);

  const isValidEmail = /^\S+@\S+\.\S+$/.test(email);
  if (!isValidEmail) {
    return res.status(400).json({ ok: false, message: 'Please enter a valid email address.' });
  }

  try {
    const now = new Date();
    const entry = {
      id: crypto.randomUUID(),
      email,
      firstName,
      lastName,
      source: 'mesh-marketing-site',
      createdAt: now.toISOString(),
      userAgent: req.headers['user-agent'] || null,
      ip: req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || null
    };

    const db = getFirestoreClient();
    const ref = db.collection('waitlist').doc(email);
    const existing = await ref.get();
    const existingData = existing.exists ? existing.data() : null;
    const createdAt = existingData?.createdAt ?? Timestamp.fromDate(now);
    const createdAtIso = existingData?.createdAtIso ?? now.toISOString();
    await ref.set(
      {
        ...entry,
        id: existingData?.id || crypto.randomUUID(),
        createdAt,
        createdAtIso,
        updatedAt: FieldValue.serverTimestamp(),
        suppressed: existingData?.suppressed === true,
        removedAt: existingData?.removedAt ?? null,
        removedBy: existingData?.removedBy ?? null
      },
      { merge: true }
    );

    let confirmationEmailSent = false;
    let addedToAudience = false;
    if (resend) {
      const emailContent = buildConfirmationEmail(email, firstName, lastName);
      try {
        await resend.emails.send({
          from: 'Mesh <noreply@try-mesh.com>',
          to: email,
          subject: emailContent.subject,
          html: emailContent.html
        });
        confirmationEmailSent = true;
      } catch (emailError) {
        console.error('[waitlist] confirmation email failed', emailError);
      }

      // Mirror the signup into a Resend audience so the admin dashboard and
      // future broadcasts see the same set. We pick the first audience
      // returned by `audiences.list()` (or the one whose id is pinned via
      // RESEND_AUDIENCE_ID env). Idempotent: contacts.create no-ops if email
      // already exists.
      try {
        let audienceId = process.env.RESEND_AUDIENCE_ID || null;
        if (!audienceId) {
          const list = await resend.audiences.list();
          audienceId = list?.data?.data?.[0]?.id || null;
        }
        if (audienceId) {
          await resend.contacts.create({
            email,
            firstName: firstName || undefined,
            lastName: lastName || undefined,
            audienceId
          });
          addedToAudience = true;
        }
      } catch (audienceError) {
        console.error('[waitlist] resend audience sync failed', audienceError);
      }
    }

    const greeting = firstName ? firstName : email;
    return res.status(200).json({
      ok: true,
      message: `Thanks, ${greeting}. You're on the waitlist.`,
      confirmationEmailSent,
      addedToAudience
    });
  } catch (error) {
    console.error('[waitlist] save failed', error);
    return res.status(500).json({
      ok: false,
      message: 'Signup failed on the server. Please try again.'
    });
  }
}
