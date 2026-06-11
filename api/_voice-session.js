import { gcpProjectId } from './_gcp-auth.js';

const SYSTEM = `You are the Mesh voice assistant on try-mesh.com.
Answer questions about Mesh CLI, MCP, IDE, install, models, and docs.
Keep replies conversational and concise (1–3 sentences unless the user asks for detail).
Only state facts from Mesh documentation. If unsure, say to check /docs or /quickstart.
Match the user's language (English or German).`;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    return res.status(204).end();
  }
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, message: 'Method Not Allowed' });
  }

  const proxyUrl = String(process.env.MESH_VOICE_PROXY_URL || '').trim();
  const enabled = Boolean(proxyUrl) && process.env.VOICE_LIVE_ENABLED !== '0';

  return res.status(200).json({
    ok: true,
    enabled,
    proxyUrl: enabled ? proxyUrl : null,
    projectId: gcpProjectId(),
    model: process.env.VOICE_LIVE_MODEL || 'gemini-live-2.5-flash-preview-native-audio-09-2025',
    voice: process.env.VOICE_LIVE_VOICE || 'Puck',
    systemInstruction: SYSTEM,
  });
}
