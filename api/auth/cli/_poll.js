import { readAndConsumeSession } from './_store.js';

/**
 * GET /api/auth/cli/poll?session_id=<sid>
 *
 * The CLI polls here every ~2s. As soon as the browser-side /auth/cli page
 * successfully POSTs to /complete, this endpoint returns the session
 * payload to the CLI and DELETES the doc — one-shot semantics, so a
 * compromised network sniff can only ever consume a session once.
 *
 * Sessions older than 10 minutes are treated as expired and pruned.
 *
 * Backed by Firestore (see _store.js). The earlier Vercel Blob backend
 * had its store suspended after the CLI's poll-loop burned the
 * "Advanced Operations" quota during the May 2026 bench run.
 */

const ALLOWED_ORIGINS = new Set([
  'https://try-mesh.com',
  'https://ide.try-mesh.com',
  'https://mesh-ide-web-466321829580.us-central1.run.app',
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
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const sessionId = String(req.query?.session_id || '').trim();
  if (!sessionId || !/^[a-f0-9]{32}$/.test(sessionId)) {
    return res.status(400).json({ error: 'session_id missing or malformed' });
  }

  try {
    const result = await readAndConsumeSession(sessionId);
    if (result.status === 'missing') return res.status(204).end();
    if (result.status === 'expired') return res.status(410).json({ error: 'session expired' });
    return res.status(200).json(result.payload);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'poll failed' });
  }
}
