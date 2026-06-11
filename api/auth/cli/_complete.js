import { writeSession } from './_store.js';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://msmonxiacxhendxehezw.supabase.co';
const ALLOWED_ORIGINS = new Set([
  'https://try-mesh.com',
  'http://localhost:3000',
  'http://localhost:3456'
]);

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

/**
 * POST /api/auth/cli/complete
 * Body: { session_id, access_token, refresh_token, expires_in?, expires_at?, email?, user_id? }
 *
 * Called by the browser-side /auth/cli page after the user successfully
 * signs into Supabase. We validate the access token belongs to a real user
 * (so the page can't forge sessions), then stash the session in a private
 * blob keyed by session_id. The CLI's poll endpoint reads it once and
 * deletes the blob — one-shot exchange.
 */
export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body || {};
  const sessionId = String(body.session_id || '').trim();
  const accessToken = String(body.access_token || '').trim();
  const refreshToken = String(body.refresh_token || '').trim();
  if (!sessionId || !/^[a-f0-9]{32}$/.test(sessionId)) {
    return res.status(400).json({ error: 'session_id missing or malformed' });
  }
  if (!accessToken) {
    return res.status(400).json({ error: 'access_token required' });
  }

  // Validate the access token against Supabase to make sure the browser
  // really signed in. Stops a malicious page from injecting fake sessions.
  if (!process.env.SUPABASE_ANON_KEY) {
    return res.status(503).json({ error: 'SUPABASE_ANON_KEY not configured' });
  }
  let user;
  try {
    const anon = createClient(SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    const { data, error } = await anon.auth.getUser(accessToken);
    if (error || !data?.user) {
      return res.status(401).json({ error: 'access_token failed Supabase verification' });
    }
    user = data.user;
  } catch (e) {
    return res.status(500).json({ error: 'supabase verification error', detail: e.message });
  }

  // Plan gate: basic users can sign IN to the website but cannot bind the CLI.
  // Read profile.plan; anything other than pro/ultra is blocked from CLI.
  // Service-role client used so the lookup is not subject to RLS.
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(503).json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' });
  }
  let plan = 'basic';
  try {
    const admin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    const { data: profile } = await admin
      .from('profiles')
      .select('plan')
      .eq('user_id', user.id)
      .maybeSingle();
    plan = (profile?.plan || 'basic').toLowerCase();
  } catch {
    // If the profiles table doesn't have a plan column yet, fall back to
    // basic — gate stays restrictive until SQL migration is applied.
    plan = 'basic';
  }

  const CLI_ALLOWED_PLANS = new Set(['pro', 'ultra']);
  if (!CLI_ALLOWED_PLANS.has(plan)) {
    // Persist a "denial" record so the polling CLI can surface a specific
    // error instead of timing out silently. Same doc path → same one-shot
    // semantics: poll reads it, deletes, agent sees the error.
    const denialPayload = {
      session_id: sessionId,
      error: 'plan_required',
      plan,
      message: `Your account is on the "${plan}" plan, which does not include CLI access. Ask an operator to upgrade you to "pro" or "ultra".`,
      contact: 'edgar.baumann@try-mesh.com',
      user: { id: user.id, email: user.email },
      issued_at: Date.now()
    };
    try { await writeSession(sessionId, denialPayload); } catch { /* best-effort */ }
    return res.status(403).json({
      error: 'plan_required',
      plan,
      message: `Your account is on the "${plan}" plan, which does not include CLI access. Ask an operator to upgrade you to "pro" or "ultra".`,
      contact: 'edgar.baumann@try-mesh.com'
    });
  }

  const payload = {
    session_id: sessionId,
    access_token: accessToken,
    refresh_token: refreshToken || null,
    expires_in: typeof body.expires_in === 'number' ? body.expires_in : null,
    expires_at: typeof body.expires_at === 'number' ? body.expires_at : null,
    user: {
      id: user.id,
      email: user.email,
      created_at: user.created_at
    },
    plan,
    issued_at: Date.now()
  };

  try {
    // The browser may call /complete more than once (OAuth onAuthStateChange
    // firing alongside an explicit Authorize click, or any retry after a
    // transient error). writeSession overwrites by default; the CLI's poll
    // endpoint deletes the doc on first read, so there's no stale session
    // to leak.
    await writeSession(sessionId, payload);
    return res.status(200).json({ ok: true, user: { email: user.email, id: user.id } });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to store cli-auth session' });
  }
}
