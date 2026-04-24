import crypto from 'node:crypto';
import { put } from '@vercel/blob';
import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

function buildConfirmationEmail(email, firstName, lastName) {
  const name = firstName ? firstName : 'there';
  return {
    subject: `${firstName ? firstName + ', you' : 'You'}'re on the Mesh waitlist`,
    html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>You're on the Mesh waitlist</title></head>
<body style="margin:0;padding:0;background:#06101a;font-family:'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#06101a;padding:48px 16px">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#0b1c28;border:1px solid rgba(255,255,255,0.07);border-radius:20px;overflow:hidden">

        <!-- Header bar -->
        <tr>
          <td style="background:linear-gradient(135deg,#081622 0%,#0d2638 100%);padding:36px 40px 32px;border-bottom:1px solid rgba(0,212,232,0.12)">
            <!-- Logo -->
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding-right:10px;vertical-align:middle">
                  <svg width="22" height="22" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
                    <path d="M10 10L5 20L10 30" stroke="#00d4e8" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M30 10L35 20L30 30" stroke="#7ceeff" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </td>
                <td style="font-size:18px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;vertical-align:middle">Mesh.</td>
              </tr>
            </table>
            <!-- Status pill -->
            <div style="margin-top:28px;display:inline-block;background:rgba(0,212,232,0.1);border:1px solid rgba(0,212,232,0.25);border-radius:100px;padding:5px 14px;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#00d4e8;font-weight:600">Waitlist Confirmed</div>
            <!-- Headline -->
            <h1 style="margin:16px 0 0;font-size:40px;font-weight:800;line-height:1.05;letter-spacing:-1px;color:#ffffff">Hey${firstName ? ' ' + firstName : ''},<br>you're in.</h1>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px">
            <p style="margin:0 0 20px;font-size:16px;line-height:1.75;color:rgba(255,255,255,0.65)">
              We've added <span style="color:#ffffff;font-weight:500">${email}</span> to the Mesh early access list. You'll hear from us when new spots open up — no spam, ever.
            </p>

            <!-- What to expect -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:14px;overflow:hidden;margin-bottom:28px">
              <tr><td style="padding:20px 24px 4px;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.35);font-weight:600">What's coming</td></tr>
              <tr>
                <td style="padding:12px 24px">
                  <table cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding-right:12px;color:#00d4e8;font-size:16px;vertical-align:top">→</td>
                      <td style="font-size:14px;line-height:1.6;color:rgba(255,255,255,0.6);padding-bottom:10px">Early access to the CLI, IDE, MCP server &amp; Gateway API</td>
                    </tr>
                    <tr>
                      <td style="padding-right:12px;color:#00d4e8;font-size:16px;vertical-align:top">→</td>
                      <td style="font-size:14px;line-height:1.6;color:rgba(255,255,255,0.6);padding-bottom:10px">3.9× context compression benchmark results &amp; deep-dives</td>
                    </tr>
                    <tr>
                      <td style="padding-right:12px;color:#00d4e8;font-size:16px;vertical-align:top">→</td>
                      <td style="font-size:14px;line-height:1.6;color:rgba(255,255,255,0.6)">Launch day invite with exclusive founding-user perks</td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr><td style="padding:0 24px 20px"></td></tr>
            </table>

            <!-- CTA -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center">
                  <a href="https://try-mesh.com" style="display:inline-block;background:#00d4e8;color:#06101a;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:10px;letter-spacing:-0.2px">Explore Mesh →</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 40px 28px;border-top:1px solid rgba(255,255,255,0.05)">
            <p style="margin:0;font-size:12px;line-height:1.6;color:rgba(255,255,255,0.25);text-align:center">
              Mesh Intelligence · <a href="https://try-mesh.com" style="color:rgba(0,212,232,0.6);text-decoration:none">try-mesh.com</a><br>
              You received this because you signed up at try-mesh.com
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
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

    const day = now.toISOString().slice(0, 10);
    const digest = crypto.createHash('sha256').update(entry.id).digest('hex').slice(0, 12);
    const path = `waitlist/${day}/${digest}.json`;

    await put(path, JSON.stringify(entry, null, 2), {
      access: 'private',
      addRandomSuffix: false,
      contentType: 'application/json'
    });

    let confirmationEmailSent = false;
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
    }

    const greeting = firstName ? firstName : email;
    return res.status(200).json({
      ok: true,
      message: `Thanks, ${greeting}. You're on the waitlist.`,
      confirmationEmailSent
    });
  } catch (error) {
    console.error('[waitlist] save failed', error);
    return res.status(500).json({
      ok: false,
      message: 'Signup failed on the server. Please try again.'
    });
  }
}
