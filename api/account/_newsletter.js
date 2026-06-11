import { createClient } from '@supabase/supabase-js';
import { FieldValue } from '@google-cloud/firestore';
import { Resend } from 'resend';
import { getFirestoreClient } from '../_firestore.js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://msmonxiacxhendxehezw.supabase.co';

function setCors(req, res) {
  const origin = req.headers.origin;
  const allowed = new Set([
    'https://try-mesh.com',
    'http://localhost:3000',
    'http://localhost:3456',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3456'
  ]);
  if (origin && allowed.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'https://try-mesh.com');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type');
  res.setHeader('Cache-Control', 'no-store');
}

async function authUserFromBearer(req) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token || !process.env.SUPABASE_ANON_KEY) return null;
  const anon = createClient(SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const {
    data: { user },
    error
  } = await anon.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

function resendClient() {
  if (!process.env.RESEND_API_KEY) return null;
  return new Resend(process.env.RESEND_API_KEY);
}

async function resolveAudienceId(resend) {
  if (!resend) return null;
  if (process.env.RESEND_AUDIENCE_ID) return process.env.RESEND_AUDIENCE_ID;
  const list = await resend.audiences.list();
  return list?.data?.data?.[0]?.id || null;
}

async function upsertAudienceContact(email) {
  const resend = resendClient();
  if (!resend) return;
  const audienceId = await resolveAudienceId(resend);
  if (!audienceId) return;
  await resend.contacts.create({ email, audienceId });
}

async function removeAudienceContact(email) {
  const resend = resendClient();
  if (!resend) return;
  const audienceId = await resolveAudienceId(resend);
  if (!audienceId) return;
  try {
    await resend.contacts.remove({ email, audienceId });
  } catch {
    // no-op if contact doesn't exist
  }
}

async function currentSubscription(email) {
  const doc = await getFirestoreClient().collection('waitlist').doc(email).get();
  if (!doc.exists) return false;
  const data = doc.data() || {};
  return data.suppressed !== true;
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  const user = await authUserFromBearer(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const email = String(user.email || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ error: 'Account has no email' });

  if (req.method === 'GET') {
    const subscribed = await currentSubscription(email);
    return res.status(200).json({ subscribed });
  }

  if (req.method === 'POST') {
    const subscribed = req.body?.subscribed === true;
    const db = getFirestoreClient();
    if (subscribed) {
      await db.collection('waitlist').doc(email).set(
        {
          email,
          source: 'mesh-account-newsletter',
          suppressed: false,
          removedAt: null,
          removedBy: null,
          updatedAt: FieldValue.serverTimestamp(),
          createdAtIso: new Date().toISOString()
        },
        { merge: true }
      );
      await upsertAudienceContact(email);
    } else {
      await db.collection('waitlist').doc(email).set(
        {
          email,
          suppressed: true,
          removedAt: FieldValue.serverTimestamp(),
          removedBy: email,
          updatedAt: FieldValue.serverTimestamp()
        },
        { merge: true }
      );
      await removeAudienceContact(email);
    }
    return res.status(200).json({ ok: true, subscribed });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
