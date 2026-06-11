import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/auth/cli/start
 *
 * Several modes, switched by ?action=:
 *
 *   default ── The CLI calls this first. We mint a fresh session_id
 *     (random UUID) and return a login URL the CLI can open in a
 *     browser, plus the polling interval and an expiry. The session_id
 *     is the only credential that lets the CLI claim the eventually-
 *     issued session.
 *
 *   ?action=login ── username → password sign-in, performed entirely
 *     server-side. The browser sends { username, password }; we resolve
 *     the username to an email with the service role and sign in. On
 *     success we return the freshly-minted session; on ANY failure we
 *     return one uniform 401 so a caller cannot tell "no such user" from
 *     "wrong password" (no username/email enumeration).
 *
 *   ?action=magic ── username → magic-link, also server-side. We resolve
 *     the username and send the OTP, but always return the same generic
 *     200 whether or not the username exists, so existence never leaks.
 *
 * The username paths live here, instead of as their own files, because
 * the Vercel Hobby tier caps deployments at 12 serverless functions.
 *
 * Note: the email paths (identifier contains "@") are handled client-
 * side in /auth/cli — the user typed their own address, so there is
 * nothing to disclose. Only the username paths route through here.
 */

const ALLOWED_ORIGINS = new Set([
  'https://try-mesh.com',
  'http://localhost:3000',
  'http://localhost:3456'
]);

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://msmonxiacxhendxehezw.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zbW9ueGlhY3hoZW5keGVoZXp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5NDU3NTMsImV4cCI6MjA5MjUyMTc1M30.K-FQFpcOwtJAIAfn5lTzmrox_6cv_8qqXGxi9IgosB8';

// Best-effort, per-instance throttle keyed by client IP. Serverless
// instances are ephemeral and not shared, so this only slows bursts that
// hit the same warm instance — Supabase GoTrue enforces the authoritative
// auth rate limit. The real anti-enumeration guarantee comes from the
// uniform responses below, not from this map.
const HITS = new Map();
function rateLimited(key, max = 12, windowMs = 60_000) {
  const now = Date.now();
  const rec = HITS.get(key);
  if (!rec || now > rec.reset) {
    HITS.set(key, { count: 1, reset: now + windowMs });
    return false;
  }
  rec.count += 1;
  return rec.count > max;
}

function clientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  const first = (Array.isArray(xff) ? xff[0] : xff || '').split(',')[0].trim();
  return first || req.socket?.remoteAddress || 'unknown';
}

function setCors(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// Reject cross-site browser callers. Same-origin POSTs and non-browser
// clients (the CLI) send no Origin header and are allowed through; the
// uniform responses cover the no-Origin case against enumeration.
function originRejected(req) {
  const origin = req.headers.origin;
  return Boolean(origin) && !ALLOWED_ORIGINS.has(origin);
}

function parseBody(req) {
  if (typeof req.body === 'object' && req.body) return req.body;
  try {
    return JSON.parse(req.body || '{}');
  } catch {
    return null;
  }
}

function adminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createClient(SUPABASE_URL, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const action = req.query?.action || (req.url?.includes('action=login')
    ? 'login'
    : req.url?.includes('action=magic')
      ? 'magic'
      : '');

  if (action === 'login' || action === 'magic') {
    if (originRejected(req)) return res.status(403).json({ error: 'origin not allowed' });
    if (rateLimited(clientIp(req))) {
      return res.status(429).json({ error: 'Too many attempts. Try again in a minute.' });
    }
    return action === 'login' ? passwordLogin(req, res) : magicLink(req, res);
  }

  const sessionId = crypto.randomBytes(16).toString('hex');
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const base = `https://${req.headers.host || 'try-mesh.com'}`;
  return res.status(200).json({
    session_id: sessionId,
    login_url: `${base}/auth/cli?session_id=${sessionId}`,
    poll_interval_ms: 2000,
    expires_at: expiresAt
  });
}

function readUsername(body) {
  const username = String(body?.username || '').trim().toLowerCase();
  return /^[a-z0-9_.-]{2,40}$/.test(username) ? username : '';
}

// Resolve a username to its account email using the service role. Returns
// null when the username does not map to an account with an email.
async function emailForUsername(admin, username) {
  const { data: row } = await admin
    .from('profiles')
    .select('user_id')
    .ilike('username', username)
    .limit(1)
    .maybeSingle();
  if (!row?.user_id) return null;
  const { data: userResp } = await admin.auth.admin.getUserById(row.user_id);
  return userResp?.user?.email || null;
}

async function passwordLogin(req, res) {
  // One uniform failure response — never distinguishes unknown username
  // from wrong password, so credentials cannot be enumerated.
  const deny = () => res.status(401).json({ error: 'Invalid username/email or password.' });

  const body = parseBody(req);
  if (!body) return res.status(400).json({ error: 'invalid JSON body' });
  const username = readUsername(body);
  const password = String(body.password || '');
  if (!username || !password) return deny();

  const admin = adminClient();
  if (!admin) return res.status(503).json({ error: 'username login not configured' });

  let email;
  try {
    email = await emailForUsername(admin, username);
  } catch {
    return res.status(500).json({ error: 'lookup failed' });
  }
  if (!email) return deny();

  const { data, error } = await admin.auth.signInWithPassword({ email, password });
  if (error || !data?.session || !data?.user) return deny();

  return res.status(200).json({
    session: {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_in: data.session.expires_in,
      expires_at: data.session.expires_at,
      // The signed-in user's own email — legitimate to return post-auth.
      user: { id: data.user.id, email: data.user.email }
    }
  });
}

async function magicLink(req, res) {
  // Uniform success response regardless of whether the username exists,
  // so the magic-link path also leaks nothing about account existence.
  const ok = () => res.status(200).json({ sent: true });

  const body = parseBody(req);
  if (!body) return res.status(400).json({ error: 'invalid JSON body' });
  const username = readUsername(body);
  const sessionId = String(body.session_id || '');
  if (!username || !/^[a-f0-9]{32}$/.test(sessionId)) {
    // Malformed input never reveals existence either.
    return ok();
  }

  const admin = adminClient();
  if (!admin) return res.status(503).json({ error: 'username login not configured' });

  let email;
  try {
    email = await emailForUsername(admin, username);
  } catch {
    return ok();
  }
  if (!email) return ok();

  const host = req.headers.host || 'try-mesh.com';
  const redirect = `https://${host}/auth/cli?session_id=${sessionId}`;
  const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  try {
    await anon.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect } });
  } catch {
    /* swallow — uniform response below */
  }
  return ok();
}
