export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'Method Not Allowed' });
  }

  const email = String(req.body?.email || '').trim().toLowerCase();
  const isValidEmail = /^\S+@\S+\.\S+$/.test(email);
  if (!isValidEmail) {
    return res.status(400).json({ ok: false, message: 'Please enter a valid email address.' });
  }

  // Placeholder integration:
  // In production, persist to a DB/CRM (e.g. Postgres, HubSpot, Mailchimp, Resend audience).
  return res.status(200).json({
    ok: true,
    message: `Thanks, ${email} was added to the waitlist.`
  });
}
