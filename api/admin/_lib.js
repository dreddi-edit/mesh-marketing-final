import { createClient } from '@supabase/supabase-js';
import { resolveConsoleRole, permissionsFor } from './_permissions.js';

export const SUPABASE_URL = process.env.SUPABASE_URL || 'https://msmonxiacxhendxehezw.supabase.co';

const ALLOWED_ORIGINS = new Set([
  'https://try-mesh.com',
  'http://localhost:3000',
  'http://localhost:3456',
  'http://127.0.0.1:3456',
  'http://127.0.0.1:3000'
]);

const DEFAULT_ADMIN_EMAILS = [
  'edgar@mailbaumann.de',
  'edgar.baumann@try-mesh.com'
];

export function getAdminEmails() {
  const raw = process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL;
  const fromEnv = raw
    ? raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
    : [];
  return [...new Set([...fromEnv, ...DEFAULT_ADMIN_EMAILS])];
}

/** @deprecated use resolveConsoleRole */
export function isAdminEmail(email) {
  return getAdminEmails().includes(String(email || '').trim().toLowerCase());
}

export function setCors(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'https://try-mesh.com');
  }
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type');
}

export function requiredSupabaseEnvMissing() {
  return !process.env.SUPABASE_ANON_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY;
}

export function adminClient() {
  return createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

async function getAuthUserFromToken(req) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token || !process.env.SUPABASE_ANON_KEY) return null;
  try {
    const anon = createClient(SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    const {
      data: { user },
      error
    } = await anon.auth.getUser(token);
    if (error || !user) return null;
    return user;
  } catch {
    return null;
  }
}

/**
 * Verify bearer token and console role.
 * @param {import('http').IncomingMessage} req
 * @param {{ requireWrite?: boolean }} opts
 */
export async function verifyConsoleUser(req, { requireWrite = false } = {}) {
  const user = await getAuthUserFromToken(req);
  if (!user) return null;

  const sb = adminClient();
  const role = await resolveConsoleRole(sb, user, getAdminEmails());
  if (!role) return null;

  const permissions = permissionsFor(role);
  if (requireWrite && !permissions.canWrite) return null;

  return { user, role, permissions };
}

/** Back-compat alias for handlers not yet migrated */
export async function verifyAdmin(req) {
  const ctx = await verifyConsoleUser(req, { requireWrite: false });
  return ctx?.user ?? null;
}
