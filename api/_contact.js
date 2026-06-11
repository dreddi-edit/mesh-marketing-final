import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const NOTIFY_TO = (process.env.CONTACT_NOTIFY_EMAIL || 'edgar.baumann@try-mesh.com')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const NOTIFY_CC = (process.env.CONTACT_NOTIFY_CC || 'philipp.horn@try-mesh.com')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function clip(str, max = 500) {
  return String(str || '').trim().slice(0, max);
}

function isValidEmail(email) {
  return /^\S+@\S+\.\S+$/.test(email);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildNotification({ email, subject, message }) {
  const html = `<!DOCTYPE html><html><body style="margin:0;background:#020406;color:#fff;font-family:system-ui,sans-serif;padding:32px">
    <h2 style="font-size:20px;margin:0 0 8px;color:#00d4e8">Mesh contact form</h2>
    <p style="color:rgba(255,255,255,0.5);font-size:14px;margin:0 0 24px">From ${escapeHtml(email)}</p>
    <table style="border-collapse:collapse;width:100%;max-width:560px">
      <tr>
        <td style="padding:8px 12px 8px 0;color:rgba(255,255,255,0.45);font-family:monospace;font-size:11px;vertical-align:top;white-space:nowrap">Subject</td>
        <td style="padding:8px 0;color:#fff;font-size:14px">${escapeHtml(subject)}</td>
      </tr>
      <tr>
        <td style="padding:8px 12px 8px 0;color:rgba(255,255,255,0.45);font-family:monospace;font-size:11px;vertical-align:top;white-space:nowrap">Message</td>
        <td style="padding:8px 0;color:#fff;font-size:14px;white-space:pre-wrap;line-height:1.55">${escapeHtml(message)}</td>
      </tr>
    </table>
  </body></html>`;

  return {
    subject: `[Mesh Contact] ${subject}`,
    html
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'Method Not Allowed' });
  }

  if (!resend) {
    return res.status(503).json({
      ok: false,
      message: 'Contact form is temporarily unavailable. Please try again later.'
    });
  }

  const email = clip(req.body?.email, 200).toLowerCase();
  const subject = clip(req.body?.subject, 200);
  const message = clip(req.body?.message, 5000);

  if (!isValidEmail(email)) {
    return res.status(400).json({ ok: false, message: 'Please enter a valid email address.' });
  }
  if (!subject) {
    return res.status(400).json({ ok: false, message: 'Please enter a subject.' });
  }
  if (!message || message.length < 10) {
    return res.status(400).json({
      ok: false,
      message: 'Please enter your message (at least 10 characters).'
    });
  }

  const mail = buildNotification({ email, subject, message });

  try {
    await resend.emails.send({
      from: 'Mesh <noreply@try-mesh.com>',
      to: NOTIFY_TO,
      cc: NOTIFY_CC.length ? NOTIFY_CC : undefined,
      replyTo: email,
      subject: mail.subject,
      html: mail.html
    });
  } catch (err) {
    console.error('[contact] send failed', err);
    return res.status(503).json({
      ok: false,
      message: 'We could not send your message. Please try again in a moment.'
    });
  }

  return res.status(200).json({
    ok: true,
    message: 'Thanks — your message was sent. We will get back to you by email.'
  });
}
