import crypto from 'node:crypto';
import { Resend } from 'resend';
import { Firestore, FieldValue } from '@google-cloud/firestore';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const NOTIFY_TO = (process.env.AMBASSADOR_NOTIFY_EMAIL || 'edgar.baumann@try-mesh.com')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const NOTIFY_CC = (process.env.AMBASSADOR_NOTIFY_CC || 'philipp.horn@try-mesh.com')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const COLLECTION = 'ambassador-applications';
let _client = null;

function firestore() {
  if (_client) return _client;
  const raw = process.env.GCP_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  let creds;
  try {
    creds = JSON.parse(raw);
  } catch {
    return null;
  }
  _client = new Firestore({
    projectId: creds.project_id,
    credentials: {
      client_email: creds.client_email,
      private_key: creds.private_key
    }
  });
  return _client;
}

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

function row(label, value) {
  if (!value) return '';
  return `<tr><td style="padding:8px 12px 8px 0;color:rgba(255,255,255,0.45);font-family:monospace;font-size:11px;vertical-align:top;white-space:nowrap">${escapeHtml(label)}</td><td style="padding:8px 0;color:#fff;font-size:14px">${escapeHtml(value)}</td></tr>`;
}

function buildTeamNotification(entry) {
  const name = [entry.firstName, entry.lastName].filter(Boolean).join(' ') || entry.email;
  const socials = [
    entry.tiktok && `TikTok: ${entry.tiktok}`,
    entry.x && `X: ${entry.x}`,
    entry.youtube && `YouTube: ${entry.youtube}`,
    entry.instagram && `Instagram: ${entry.instagram}`,
    entry.linkedin && `LinkedIn: ${entry.linkedin}`,
    entry.otherSocial && `Other: ${entry.otherSocial}`
  ].filter(Boolean);

  const html = `<!DOCTYPE html><html><body style="margin:0;background:#020406;color:#fff;font-family:system-ui,sans-serif;padding:32px">
    <h2 style="font-size:20px;margin:0 0 8px;color:#00d4e8">New Brand Ambassador application</h2>
    <p style="color:rgba(255,255,255,0.5);font-size:14px;margin:0 0 24px">${escapeHtml(name)} · ${escapeHtml(entry.email)}</p>
    <table style="border-collapse:collapse;width:100%;max-width:560px">
      ${row('Phone', entry.phone)}
      ${row('Location', entry.location)}
      ${row('Audience', entry.audienceSize)}
      ${row('Content focus', entry.contentFocus)}
      ${socials.length ? row('Socials', socials.join('\n')) : ''}
      ${row('Why Mesh', entry.whyMesh)}
      ${row('Pitch', entry.pitch)}
      ${row('Consent', entry.consent ? 'Yes' : 'No')}
      ${row('Submitted', entry.createdAt)}
    </table>
  </body></html>`;

  return {
    subject: `[Mesh Ambassador] ${name}`,
    html
  };
}

function buildApplicantConfirmation(firstName) {
  const greeting = firstName || 'there';
  return {
    subject: 'Mesh Brand Ambassador — application received',
    html: `<!DOCTYPE html><html><body style="margin:0;background:#020406;color:#fff;font-family:system-ui,sans-serif;padding:40px 24px">
      <p style="color:#00d4e8;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;margin:0 0 16px">Mesh · Brand Ambassador</p>
      <h1 style="font-size:28px;margin:0 0 16px;font-weight:700">Thanks, ${escapeHtml(greeting)}.</h1>
      <p style="color:rgba(255,255,255,0.55);font-size:15px;line-height:1.6;max-width:420px;margin:0">
        We received your application. Our team will review your profile and social channels and get back to you by email.
      </p>
      <p style="color:rgba(255,255,255,0.35);font-size:13px;margin-top:32px">— Mesh Team</p>
    </body></html>`
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'Method Not Allowed' });
  }

  const firstName = clip(req.body?.firstName, 80);
  const lastName = clip(req.body?.lastName, 80);
  const email = clip(req.body?.email, 200).toLowerCase();
  const phone = clip(req.body?.phone, 40);
  const location = clip(req.body?.location, 120);
  const tiktok = clip(req.body?.tiktok, 300);
  const x = clip(req.body?.x, 300);
  const youtube = clip(req.body?.youtube, 300);
  const instagram = clip(req.body?.instagram, 300);
  const linkedin = clip(req.body?.linkedin, 300);
  const otherSocial = clip(req.body?.otherSocial, 300);
  const audienceSize = clip(req.body?.audienceSize, 80);
  const contentFocus = clip(req.body?.contentFocus, 200);
  const whyMesh = clip(req.body?.whyMesh, 2000);
  const pitch = clip(req.body?.pitch, 2000);
  const consent = Boolean(req.body?.consent);

  if (!firstName || !lastName) {
    return res.status(400).json({ ok: false, message: 'Please enter your first and last name.' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ ok: false, message: 'Please enter a valid email address.' });
  }
  if (!phone) {
    return res.status(400).json({ ok: false, message: 'Please enter a phone number so we can reach you.' });
  }
  const hasSocial = tiktok || x || youtube || instagram || linkedin || otherSocial;
  if (!hasSocial) {
    return res.status(400).json({ ok: false, message: 'Add at least one social profile link.' });
  }
  if (!whyMesh || whyMesh.length < 20) {
    return res.status(400).json({ ok: false, message: 'Tell us briefly why you want to represent Mesh (at least 20 characters).' });
  }
  if (!consent) {
    return res.status(400).json({ ok: false, message: 'Please confirm you agree to be contacted about this application.' });
  }

  const now = new Date();
  const entry = {
    id: crypto.randomUUID(),
    firstName,
    lastName,
    email,
    phone,
    location,
    tiktok,
    x,
    youtube,
    instagram,
    linkedin,
    otherSocial,
    audienceSize,
    contentFocus,
    whyMesh,
    pitch,
    consent,
    source: 'mesh-socials-ambassador',
    createdAt: now.toISOString(),
    userAgent: req.headers['user-agent'] || null,
    ip: req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || null
  };

  let teamNotified = false;
  let confirmationSent = false;
  let stored = false;

  if (resend) {
    const teamMail = buildTeamNotification(entry);
    try {
      await resend.emails.send({
        from: 'Mesh <noreply@try-mesh.com>',
        to: NOTIFY_TO,
        cc: NOTIFY_CC.length ? NOTIFY_CC : undefined,
        replyTo: email,
        subject: teamMail.subject,
        html: teamMail.html
      });
      teamNotified = true;
    } catch (err) {
      console.error('[ambassador] team notification failed', err);
    }

    try {
      const confirm = buildApplicantConfirmation(firstName);
      await resend.emails.send({
        from: 'Mesh <noreply@try-mesh.com>',
        to: email,
        subject: confirm.subject,
        html: confirm.html
      });
      confirmationSent = true;
    } catch (err) {
      console.error('[ambassador] applicant confirmation failed', err);
    }
  }

  try {
    const db = firestore();
    if (db) {
      await db
        .collection(COLLECTION)
        .doc(entry.id)
        .set({ ...entry, _writtenAt: FieldValue.serverTimestamp() }, { merge: false });
      stored = true;
    }
  } catch (error) {
    console.error('[ambassador] firestore save failed', error);
  }

  if (!teamNotified && !stored) {
    const hint = resend
      ? 'We could not deliver your application. Email us at edgar.baumann@try-mesh.com.'
      : 'Applications are temporarily unavailable. Email edgar.baumann@try-mesh.com.';
    return res.status(503).json({ ok: false, message: hint });
  }

  const greeting = firstName;
  return res.status(200).json({
    ok: true,
    message: `Thanks, ${greeting}. Your application was submitted.`,
    teamNotified,
    confirmationSent,
    stored
  });
}
