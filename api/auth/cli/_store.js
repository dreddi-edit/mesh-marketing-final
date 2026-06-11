/**
 * Shared session store for the CLI auth handshake.
 *
 * Backed by Google Cloud Firestore. We picked Firestore over Vercel Blob
 * because (a) the user already has GCP credits, (b) Firestore has a generous
 * free tier (50k reads + 20k writes per day), (c) it supports a built-in
 * TTL policy that auto-expires the auth blobs after 10 min, and (d) the
 * Vercel Blob route earlier suspended the store entirely under quota
 * overage during the May 2026 bench iteration.
 *
 * Setup checklist (done once per environment):
 *   1. Enable Firestore in the same GCP project that hosts the LLM proxy.
 *   2. Create a service account with "Cloud Datastore User" role.
 *   3. Download its JSON key.
 *   4. Set the env var GCP_SERVICE_ACCOUNT_JSON to the entire JSON string
 *      (one line, escaped). Vercel handles multi-line env values, so the
 *      JSON can be pasted verbatim as a multi-line value.
 *   5. Apply a TTL policy in Firestore on the field `expiresAt` for the
 *      `cli-auth` collection. (gcloud firestore fields ttls update expiresAt
 *      --collection-group=cli-auth)
 */

import { Firestore, FieldValue, Timestamp } from '@google-cloud/firestore';

const COLLECTION = 'cli-auth';
const MAX_AGE_MS = 10 * 60 * 1000;

let _client = null;

function client() {
  if (_client) return _client;
  const raw = process.env.GCP_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error('GCP_SERVICE_ACCOUNT_JSON not configured');
  }
  let creds;
  try {
    creds = JSON.parse(raw);
  } catch {
    throw new Error('GCP_SERVICE_ACCOUNT_JSON is not valid JSON');
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

/**
 * Write the session payload under document id = sessionId.
 * Includes an expiresAt Timestamp so the Firestore TTL policy can purge it.
 */
export async function writeSession(sessionId, payload) {
  const expiresAt = Timestamp.fromMillis(Date.now() + MAX_AGE_MS);
  await client()
    .collection(COLLECTION)
    .doc(sessionId)
    .set({ ...payload, expiresAt, _writtenAt: FieldValue.serverTimestamp() });
}

/**
 * Read the session payload by sessionId. Returns null if missing or expired.
 * Aged-out docs are deleted opportunistically — the TTL policy is the
 * primary cleanup but this protects against the policy lagging.
 */
export async function readAndConsumeSession(sessionId) {
  const ref = client().collection(COLLECTION).doc(sessionId);
  const snap = await ref.get();
  if (!snap.exists) return { status: 'missing' };

  const data = snap.data() || {};
  const writtenMs = data._writtenAt?.toMillis?.() ?? data.issued_at ?? 0;
  const ageMs = writtenMs ? Date.now() - writtenMs : 0;
  if (writtenMs && ageMs > MAX_AGE_MS) {
    await ref.delete().catch(() => undefined);
    return { status: 'expired' };
  }

  // One-shot semantics: delete after read so a leaked session_id can only
  // be consumed once. Best-effort — even if the delete fails, the TTL
  // policy will purge within ~24h.
  await ref.delete().catch(() => undefined);

  const { expiresAt: _exp, _writtenAt: _w, ...payload } = data;
  return { status: 'ok', payload };
}
