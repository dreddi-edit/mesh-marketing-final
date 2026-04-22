export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'Method Not Allowed' });
  }

  const email = String(req.body?.email || '').trim().toLowerCase();
  const isValidEmail = /^\S+@\S+\.\S+$/.test(email);
  if (!isValidEmail) {
    return res.status(400).json({ ok: false, message: 'Please enter a valid email address.' });
  }

  // Temporary behavior:
  // Request is received and logged. Persistent waitlist storage is not wired yet.
  console.log(`[waitlist] ${new Date().toISOString()} ${email}`);
  return res.status(200).json({
    ok: true,
    message: `Thanks, ${email}. Your signup request was received.`
  });
}
