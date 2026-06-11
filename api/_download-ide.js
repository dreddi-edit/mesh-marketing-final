import { Storage } from '@google-cloud/storage';

// Per-OS storage targets. Env vars override the defaults so we can move buckets
// or change filenames without redeploying client code.
const OS_TARGETS = {
  macos: {
    object: process.env.IDE_DOWNLOAD_OBJECT_MACOS || process.env.IDE_DOWNLOAD_OBJECT || 'ide/macos/Mesh.dmg',
    publicUrl: process.env.IDE_DOWNLOAD_PUBLIC_URL_MACOS || process.env.IDE_DOWNLOAD_PUBLIC_URL || ''
  },
  windows: {
    object: process.env.IDE_DOWNLOAD_OBJECT_WINDOWS || 'ide/windows/Mesh-Setup.exe',
    publicUrl: process.env.IDE_DOWNLOAD_PUBLIC_URL_WINDOWS || ''
  }
};

const TARGET_BUCKET = process.env.IDE_DOWNLOAD_BUCKET || process.env.GCS_DOWNLOAD_BUCKET || '';

let _storage = null;

function storageClient() {
  if (_storage) return _storage;

  const raw = process.env.GCP_SERVICE_ACCOUNT_JSON;
  if (raw) {
    let creds;
    try {
      creds = JSON.parse(raw);
    } catch {
      throw new Error('GCP_SERVICE_ACCOUNT_JSON is not valid JSON');
    }
    _storage = new Storage({
      projectId: creds.project_id,
      credentials: {
        client_email: creds.client_email,
        private_key: creds.private_key
      }
    });
    return _storage;
  }

  // Local/dev fallback via gcloud ADC.
  _storage = new Storage({
    projectId: process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || undefined
  });
  return _storage;
}

function pickOs(req) {
  const raw = String(req.query?.os || '').trim().toLowerCase();
  if (raw === 'windows' || raw === 'win' || raw === 'win32') return 'windows';
  return 'macos';
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const os = pickOs(req);
  const target = OS_TARGETS[os];

  try {
    if (target.publicUrl) {
      return res.redirect(302, target.publicUrl);
    }

    if (!TARGET_BUCKET) {
      return res.redirect(302, '/docs#ide-launch');
    }

    const file = storageClient().bucket(TARGET_BUCKET).file(target.object);
    const [exists] = await file.exists();
    if (!exists) {
      return res.redirect(302, '/docs#ide-launch');
    }

    const [url] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 15 * 60 * 1000
    });

    return res.redirect(302, url);
  } catch (error) {
    console.error('[download-ide] failed', { os, error: error?.message || error });
    return res.redirect(302, '/docs#ide-launch');
  }
}
