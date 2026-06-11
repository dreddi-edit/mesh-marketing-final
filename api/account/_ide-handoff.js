/**
 * /api/account/ide-handoff
 *
 * Mints a one-time signed URL the /account page can use to send the logged-in
 * user straight into the browser IDE without a second login.
 *
 * Flow:
 *   1. Client (auth.html → account.html) POSTs with `Authorization: Bearer <jwt>`.
 *   2. We verify the JWT against Supabase's /auth/v1/user endpoint.
 *   3. We pre-stash a session-id keyed payload in the same Firestore
 *      collection (`cli-auth`) the CLI handshake uses, with the user's
 *      access_token + refresh_token + user descriptor.
 *   4. We return `{ url }` pointing at the IDE host (env override) with
 *      `?session_id=<one-time>` appended. The IDE polls /api/auth/cli/poll
 *      exactly like the CLI does and lands signed in.
 *
 * Once the IDE consumes the session_id (one-shot semantics in _store.js),
 * a leaked URL cannot be replayed.
 *
 * Env vars:
 *   GCP_SERVICE_ACCOUNT_JSON   — required (used by _store.js)
 *   SUPABASE_URL               — defaults to the public Mesh project URL
 *   SUPABASE_ANON_KEY          — required to call /auth/v1/user
 *   IDE_WEB_BASE_URL           — public URL of the hosted IDE
 *                                (default: https://ide.try-mesh.com)
 */

import crypto from 'node:crypto';
import { writeSession } from '../auth/cli/_store.js';

const SUPABASE_URL  = process.env.SUPABASE_URL   || 'https://msmonxiacxhendxehezw.supabase.co';
const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY;
// Cloud Run hosts the Theia browser image at the URL below. Override via the
// IDE_WEB_BASE_URL env var once a custom domain (e.g. ide.try-mesh.com) is
// mapped. NOTE: the Cloud Run service requires public-invoker IAM; until
// the org-policy `iam.allowedPolicyMemberDomains` is overridden at the
// project level, browser requests will hit a 403.
const IDE_WEB_BASE  = process.env.IDE_WEB_BASE_URL
    || 'https://mesh-ide-web-466321829580.us-central1.run.app';

function fail(res, status, code, hint) {
    res.setHeader('content-type', 'application/json');
    res.status(status).end(JSON.stringify({ error: code, hint }));
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return fail(res, 405, 'method_not_allowed', 'POST only');
    }
    if (!SUPABASE_ANON) {
        return fail(res, 503, 'misconfigured', 'SUPABASE_ANON_KEY missing');
    }

    const auth = req.headers.authorization || '';
    if (!auth.startsWith('Bearer ')) {
        return fail(res, 401, 'unauthenticated', 'Bearer token required');
    }
    const accessToken = auth.slice(7).trim();
    if (!accessToken) {
        return fail(res, 401, 'unauthenticated', 'Empty bearer');
    }

    let user;
    try {
        const verify = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
            headers: { apikey: SUPABASE_ANON, authorization: `Bearer ${accessToken}` },
        });
        if (!verify.ok) {
            return fail(res, 401, 'unauthenticated', `auth/v1/user returned ${verify.status}`);
        }
        user = await verify.json();
    } catch (err) {
        return fail(res, 502, 'supabase_unreachable', err?.message || 'fetch failed');
    }
    if (!user?.id || !user?.email) {
        return fail(res, 401, 'unauthenticated', 'malformed user payload');
    }

    // Refresh token is optional — the IDE will re-derive expiry from the
    // current access token if missing. We only forward what the marketing
    // session already has (the body may carry it).
    let refreshToken;
    try {
        const body = req.body && typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');
        if (typeof body.refresh_token === 'string') refreshToken = body.refresh_token;
    } catch { /* no body — fine */ }

    const sessionId = crypto.randomBytes(16).toString('hex');
    const payload = {
        access_token:  accessToken,
        refresh_token: refreshToken || null,
        // Derive expires_at from the JWT exp claim where possible.
        expires_at:    decodeJwtExp(accessToken),
        user: {
            id:    user.id,
            email: user.email,
            user_metadata: user.user_metadata || undefined,
        },
        provider: user.app_metadata?.provider || 'email',
        issued_via: 'account-ide-handoff',
        issued_at: Date.now(),
    };

    try {
        await writeSession(sessionId, payload);
    } catch (err) {
        return fail(res, 502, 'store_unavailable', err?.message || 'firestore write failed');
    }

    const url = `${IDE_WEB_BASE}/?session_id=${sessionId}`;
    res.setHeader('content-type', 'application/json');
    res.setHeader('cache-control', 'no-store');
    res.status(200).end(JSON.stringify({ url, session_id: sessionId }));
}

function decodeJwtExp(jwt) {
    try {
        const parts = jwt.split('.');
        if (parts.length !== 3) return undefined;
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
        if (typeof payload.exp === 'number') return payload.exp;
    } catch { /* ignore */ }
    return undefined;
}
