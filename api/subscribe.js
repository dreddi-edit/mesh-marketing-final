import crypto from 'node:crypto';
import { put } from '@vercel/blob';
import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

function buildConfirmationEmail(email) {
  return {
    subject: 'You are on the Mesh waitlist',
    html: `
      <div style="margin:0;padding:32px;background:#08131a;color:#f7fbfc;font-family:Inter,Arial,sans-serif">
        <div style="max-width:560px;margin:0 auto;background:#0f1d26;border:1px solid rgba(255,255,255,0.08);border-radius:18px;padding:32px">
          <div style="font-size:13px;letter-spacing:0.14em;text-transform:uppercase;color:#00d4e8;margin-bottom:18px">Mesh Waitlist</div>
          <h1 style="margin:0 0 14px;font-size:34px;line-height:1;color:#ffffff">You are in.</h1>
          <p style="margin:0 0 16px;font-size:16px;line-height:1.7;color:rgba(255,255,255,0.74)">
            ${email} is now on the Mesh waitlist.
          </p>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:rgba(255,255,255,0.58)">
            We will send you product updates and early access information from this address when new spots open up.
          </p>
          <div style="padding:14px 16px;border-radius:12px;background:rgba(0,212,232,0.08);border:1px solid rgba(0,212,232,0.18);font-size:14px;line-height:1.6;color:#c8f7ff">
            Expected next emails: launch updates, access invites, and product announcements.
          </div>
          <div style="margin-top:24px;font-size:12px;line-height:1.6;color:rgba(255,255,255,0.38)">
            Mesh Intelligence · try-mesh.com
          </div>
        </div>
      </div>
    `
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'Method Not Allowed' });
  }

  const email = String(req.body?.email || '').trim().toLowerCase();
  const isValidEmail = /^\S+@\S+\.\S+$/.test(email);
  if (!isValidEmail) {
    return res.status(400).json({ ok: false, message: 'Please enter a valid email address.' });
  }

  try {
    const now = new Date();
    const entry = {
      id: crypto.randomUUID(),
      email,
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
      const emailContent = buildConfirmationEmail(email);
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
    } else {
      console.warn('[waitlist] RESEND_API_KEY missing, confirmation email skipped');
    }

    return res.status(200).json({
      ok: true,
      message: `Thanks, ${email}. You are now on the waitlist.`,
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
