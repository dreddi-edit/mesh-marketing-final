import { Firestore } from '@google-cloud/firestore';

let _client = null;

export function getFirestoreClient() {
  if (_client) return _client;

  const raw = process.env.GCP_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    // Local/dev fallback: use Application Default Credentials from gcloud.
    // Vercel production still uses GCP_SERVICE_ACCOUNT_JSON.
    _client = new Firestore({
      projectId: process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || undefined
    });
    return _client;
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

