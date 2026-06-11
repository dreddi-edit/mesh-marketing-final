import crypto from 'node:crypto';

let _cached = { token: null, expiresAt: 0 };

function parseServiceAccount() {
  const raw = process.env.GCP_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const creds = JSON.parse(raw);
    if (creds.private_key?.includes('\\n')) {
      creds.private_key = creds.private_key.replace(/\\n/g, '\n');
    }
    return creds;
  } catch {
    throw new Error('GCP_SERVICE_ACCOUNT_JSON is not valid JSON');
  }
}

async function tokenFromServiceAccount(creds) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const claim = Buffer.from(JSON.stringify({
    iss: creds.client_email,
    sub: creds.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
  })).toString('base64url');
  const signInput = `${header}.${claim}`;
  const sign = crypto.createSign('RSA-SHA256').update(signInput).sign(creds.private_key, 'base64url');
  const jwt = `${signInput}.${sign}`;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  if (!response.ok) {
    throw new Error(`GCP token exchange failed: ${response.status}`);
  }
  const data = await response.json();
  return data.access_token;
}

/** OAuth access token for Discovery Engine / Vertex APIs on Vercel. */
export async function getGcpAccessToken() {
  const now = Date.now();
  if (_cached.token && _cached.expiresAt > now + 60_000) {
    return _cached.token;
  }

  const creds = parseServiceAccount();
  if (!creds) {
    throw new Error('GCP_SERVICE_ACCOUNT_JSON not configured');
  }

  const token = await tokenFromServiceAccount(creds);
  _cached = { token, expiresAt: now + 55 * 60 * 1000 };
  return token;
}

export function gcpProjectId() {
  const creds = parseServiceAccount();
  return (
    process.env.GCP_PROJECT_ID
    || process.env.GOOGLE_CLOUD_PROJECT
    || creds?.project_id
    || 'mesh-494913'
  );
}
