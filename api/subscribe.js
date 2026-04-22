import crypto from 'node:crypto';
import { put } from '@vercel/blob';

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
      ip:
        req.headers['x-forwarded-for'] ||
        req.headers['x-real-ip'] ||
        null
    };

    const day = now.toISOString().slice(0, 10);
    const digest = crypto.createHash('sha256').update(entry.id).digest('hex').slice(0, 12);
    const path = `waitlist/${day}/${digest}.json`;

    await put(path, JSON.stringify(entry, null, 2), {
      access: 'private',
      addRandomSuffix: false,
      contentType: 'application/json'
    });

    return res.status(200).json({
      ok: true,
      message: `Thanks, ${email}. You are now on the waitlist.`
    });
  } catch (error) {
    console.error('[waitlist] save failed', error);
    return res.status(500).json({
      ok: false,
      message: 'Signup failed on the server. Please try again.'
    });
  }
}
