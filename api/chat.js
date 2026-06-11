/**
 * Mesh homepage Q&A — SSE streaming, Firestore cache, Vertex Search + Gemini.
 *
 * Vercel env: GCP_SERVICE_ACCOUNT_JSON, GCP_PROJECT_ID, CHAT_MODEL (default gemini-2.5-flash),
 * VERTEX_LOCATION (global), DISCOVERY_ENGINE_ID, CHAT_CACHE_VERSION, CHAT_DAILY_LIMIT
 */
import crypto from 'node:crypto';
import { FieldValue } from '@google-cloud/firestore';
import { getGcpAccessToken, gcpProjectId } from './_gcp-auth.js';
import { getFirestoreClient } from './_firestore.js';

const LOCATION = process.env.DISCOVERY_LOCATION || 'global';
const VERTEX_LOCATION = process.env.VERTEX_LOCATION || 'global';
const COLLECTION = process.env.DISCOVERY_COLLECTION || 'default_collection';
const ENGINE_ID = process.env.DISCOVERY_ENGINE_ID || 'mesh-docs-search';
const CHAT_MODEL = process.env.CHAT_MODEL || 'gemini-2.5-flash';
const DAILY_LIMIT = Number(process.env.CHAT_DAILY_LIMIT || 40);
const CACHE_VERSION = process.env.CHAT_CACHE_VERSION || '5';
const MAX_SENTENCES = 3;
const MAX_BODY_CHARS = 380;

const CHAT_SYSTEM = `You are the Mesh website chat bot. MAX 2-3 short sentences (~70 words). NO lists, NO numbered sections, NO command catalogs unless user asked for ONE specific command. End with <<options>> block (2-3 lines: label|question). Match user language.`;

const OPTIONS_RE = /<<options>>([\s\S]*?)<\/options>>/i;
const CACHE_TTL_MS = Number(process.env.CHAT_CACHE_TTL_DAYS || 30) * 24 * 60 * 60 * 1000;
const MEMORY_CACHE = new Map();

function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}

function ipHash(ip) {
  return crypto.createHash('sha256').update(`${ip}:mesh-chat`).digest('hex').slice(0, 32);
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeQuery(query) {
  return query
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cacheDocId(query) {
  return crypto
    .createHash('sha256')
    .update(`${CACHE_VERSION}:${normalizeQuery(query)}`)
    .digest('hex');
}

function readMemoryCache(docId) {
  const hit = MEMORY_CACHE.get(docId);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    MEMORY_CACHE.delete(docId);
    return null;
  }
  return hit.payload;
}

function writeMemoryCache(docId, payload) {
  MEMORY_CACHE.set(docId, { payload, expiresAt: Date.now() + CACHE_TTL_MS });
  if (MEMORY_CACHE.size > 200) {
    const oldest = MEMORY_CACHE.keys().next().value;
    if (oldest) MEMORY_CACHE.delete(oldest);
  }
}

async function readAnswerCache(query) {
  const docId = cacheDocId(query);
  const mem = readMemoryCache(docId);
  if (mem) return { ...mem, cached: true };

  const db = getFirestoreClient();
  const snap = await db.collection('chat_cache').doc(docId).get();
  if (!snap.exists) return null;

  const data = snap.data();
  if (data.cacheVersion !== CACHE_VERSION) return null;

  const cachedAt = data.cachedAt?.toDate?.() || new Date(0);
  if (Date.now() - cachedAt.getTime() > CACHE_TTL_MS) return null;

  const payload = {
    answer: String(data.answer || ''),
    sources: Array.isArray(data.sources) ? data.sources : [],
    query: String(data.query || query),
  };
  writeMemoryCache(docId, payload);
  return { ...payload, cached: true };
}

async function writeAnswerCache(query, answer, sources) {
  const docId = cacheDocId(query);
  const payload = { answer, sources, query };
  writeMemoryCache(docId, payload);

  const db = getFirestoreClient();
  await db.collection('chat_cache').doc(docId).set({
    query: query.slice(0, 500),
    normalized: normalizeQuery(query),
    answer,
    sources,
    cacheVersion: CACHE_VERSION,
    cachedAt: FieldValue.serverTimestamp(),
    hits: FieldValue.increment(1),
  }, { merge: true });
}

async function checkRateLimit(req, { skip = false } = {}) {
  if (skip) return { allowed: true, remaining: DAILY_LIMIT };
  const db = getFirestoreClient();
  const docId = `${ipHash(clientIp(req))}_${todayKey()}`;
  const ref = db.collection('chat_rate').doc(docId);
  const snap = await ref.get();
  const count = snap.exists ? Number(snap.data()?.count || 0) : 0;
  if (count >= DAILY_LIMIT) return { allowed: false, remaining: 0 };
  await ref.set({ count: count + 1, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return { allowed: true, remaining: Math.max(0, DAILY_LIMIT - count - 1) };
}

function firstTitle(result) {
  const doc = result?.document || {};
  return doc.derivedStructData?.title || doc.structData?.title || doc.id || 'Mesh docs';
}

function firstLink(result) {
  const doc = result?.document || {};
  return doc.derivedStructData?.link || doc.structData?.uri || doc.name || '';
}

function firstSnippet(result) {
  const doc = result?.document || {};
  const snippets = doc.derivedStructData?.snippets;
  if (Array.isArray(snippets) && snippets[0]?.snippet) {
    return String(snippets[0].snippet).replace(/<[^>]+>/g, '').trim();
  }
  const extractive = doc.derivedStructData?.extractive_answers;
  if (Array.isArray(extractive) && extractive[0]?.content) {
    return String(extractive[0].content).trim();
  }
  return '';
}

function parseSources(results) {
  const seen = new Set();
  const sources = [];
  for (const result of results || []) {
    const uri = firstLink(result);
    const title = firstTitle(result);
    const key = uri || title;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    sources.push({ title, uri });
    if (sources.length >= 4) break;
  }
  return sources;
}

function buildSearchContext(payload) {
  const lines = [];
  const summary = String(payload.summary?.summaryText || '').trim();
  if (summary) lines.push(`Overview: ${summary}`);
  for (const result of payload.results || []) {
    const snippet = firstSnippet(result);
    if (!snippet) continue;
    lines.push(`Source: ${firstTitle(result)}\n${snippet}`);
    if (lines.length >= 6) break;
  }
  return lines.join('\n\n');
}

function fallbackAnswer(results) {
  const bit = (results || []).map((r) => firstSnippet(r)).find(Boolean);
  if (!bit) {
    return 'Not in the docs — try /quickstart or /docs.';
  }
  const sentence = bit.split(/(?<=[.!?])\s+/)[0] || bit;
  return sentence.slice(0, MAX_BODY_CHARS);
}

function parseOptionsBlock(text) {
  const match = text.match(OPTIONS_RE);
  const raw = match ? match[1] : '';
  const body = text.replace(OPTIONS_RE, '').trim();
  const options = raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const pipe = line.indexOf('|');
      if (pipe === -1) return { label: line, query: line };
      return { label: line.slice(0, pipe).trim(), query: line.slice(pipe + 1).trim() };
    })
    .filter((o) => o.label && o.query)
    .slice(0, 3);
  return { body, options };
}

function sanitizeBody(body) {
  let clean = String(body || '')
    .replace(/^\s*#{1,6}\s+.+$/gm, '')
    .replace(/^\s*[-*•]\s+.+$/gm, '')
    .replace(/^\s*\d+[.)]\s+.+$/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\n{2,}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const parts = clean.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [clean];
  clean = parts.slice(0, MAX_SENTENCES).join(' ').trim();
  if (clean.length > MAX_BODY_CHARS) {
    clean = `${clean.slice(0, MAX_BODY_CHARS - 1).replace(/\s+\S*$/, '')}…`;
  }
  return clean;
}

function defaultOptions(query) {
  const de = /[äöüß]|(\b(wie|was|der|die|das|für|ist)\b)/i.test(query);
  if (de) {
    return [
      { label: 'Installation', query: 'Wie installiere ich Mesh CLI?' },
      { label: 'MCP Server', query: 'Was ist der MCP Server?' },
      { label: 'Etwas anderes', query: 'Was kann Mesh noch?' },
    ];
  }
  return [
    { label: 'Install', query: 'How do I install Mesh CLI?' },
    { label: 'MCP', query: 'What is the MCP server?' },
    { label: 'Something else', query: 'What else can Mesh do?' },
  ];
}

function formatAnswer(text, query) {
  const { body, options } = parseOptionsBlock(text);
  const safeBody = sanitizeBody(body) || 'See /docs for details.';
  const safeOptions = options.length ? options : defaultOptions(query);
  const optionsBlock = safeOptions.map((o) => `${o.label}|${o.query}`).join('\n');
  return {
    body: safeBody,
    options: safeOptions,
    storage: `${safeBody}\n\n<<options>>\n${optionsBlock}\n<</options>>`,
  };
}

function vertexHost() {
  return VERTEX_LOCATION === 'global'
    ? 'https://aiplatform.googleapis.com'
    : `https://${VERTEX_LOCATION}-aiplatform.googleapis.com`;
}

function initSse(res) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof res.flushHeaders === 'function') res.flushHeaders();
}

function sendSse(res, event, data) {
  if (event) res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
  if (typeof res.flush === 'function') res.flush();
}

async function streamTextChunks(res, text, { chunkSize = 32, delayMs = 0 }) {
  for (let i = 0; i < text.length; i += chunkSize) {
    sendSse(res, 'delta', { text: text.slice(i, i + chunkSize) });
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
  }
}

async function searchDocs(query, token) {
  const projectId = gcpProjectId();
  const url = `https://discoveryengine.googleapis.com/v1/projects/${projectId}/locations/${LOCATION}/collections/${COLLECTION}/engines/${ENGINE_ID}/servingConfigs/default_search:search`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Goog-User-Project': projectId,
    },
    body: JSON.stringify({
      query,
      pageSize: 6,
      contentSearchSpec: {
        snippetSpec: { returnSnippet: true },
        extractiveContentSpec: { maxExtractiveAnswerCount: 2 },
        summarySpec: {
          summaryResultCount: 5,
          includeCitations: true,
          ignoreAdversarialQuery: true,
        },
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Discovery search ${response.status}: ${detail.slice(0, 400)}`);
  }
  return response.json();
}

async function streamGeminiAnswer(res, query, context, token) {
  const projectId = gcpProjectId();
  const url = `${vertexHost()}/v1/projects/${projectId}/locations/${VERTEX_LOCATION}/publishers/google/models/${CHAT_MODEL}:streamGenerateContent?alt=sse`;

  const prompt = `Excerpts from try-mesh.com docs:
${context}

User question: ${query}

Reply in 2-3 sentences max, then <<options>> with 2 follow-ups.`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Goog-User-Project': projectId,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: CHAT_SYSTEM }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.15, maxOutputTokens: 220 },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Gemini stream ${response.status}: ${detail.slice(0, 300)}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const jsonStr = line.slice(5).trim();
      if (!jsonStr || jsonStr === '[DONE]') continue;
      try {
        const parsed = JSON.parse(jsonStr);
        const parts = parsed.candidates?.[0]?.content?.parts || [];
        const chunk = parts.map((p) => p.text || '').join('');
        if (!chunk) continue;
        let piece = chunk;
        if (chunk.startsWith(full)) {
          piece = chunk.slice(full.length);
          full = chunk;
        } else {
          full += chunk;
        }
        if (piece) sendSse(res, 'delta', { text: piece });
      } catch {
        // skip malformed SSE chunk
      }
    }
  }

  return full.trim();
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'Method Not Allowed' });
  }

  if (process.env.CHAT_ENABLED === '0') {
    return res.status(503).json({ ok: false, message: 'Chat is temporarily disabled.' });
  }

  const query = String(req.body?.message || req.body?.query || '').trim().slice(0, 500);
  if (!query) {
    return res.status(400).json({ ok: false, message: 'message is required' });
  }

  try {
    const cached = await readAnswerCache(query);
    if (cached) {
      await checkRateLimit(req, { skip: true });
      const shaped = formatAnswer(cached.answer, query);
      initSse(res);
      sendSse(res, 'meta', { cached: true, sources: cached.sources });
      sendSse(res, 'replace', { text: shaped.body });
      sendSse(res, 'options', { items: shaped.options });
      sendSse(res, 'done', { ok: true, cached: true });
      return res.end();
    }

    const rate = await checkRateLimit(req);
    if (!rate.allowed) {
      return res.status(429).json({
        ok: false,
        message: 'Daily question limit reached. See /docs or /contact.',
        remaining: 0,
      });
    }

    initSse(res);

    const token = await getGcpAccessToken();
    const payload = await searchDocs(query, token);
    const sources = parseSources(payload.results || []);
    const context = buildSearchContext(payload);

    sendSse(res, 'meta', { cached: false, sources });

    let answer = '';
    try {
      if (context.trim()) {
        answer = await streamGeminiAnswer(res, query, context, token);
      }
    } catch (geminiErr) {
      console.error('[api/chat] gemini stream failed, using fallback', geminiErr);
    }

    if (!answer) {
      answer = fallbackAnswer(payload.results || []);
    }

    const shaped = formatAnswer(answer, query);
    sendSse(res, 'replace', { text: shaped.body });
    sendSse(res, 'options', { items: shaped.options });

    await writeAnswerCache(query, shaped.storage, sources);
    sendSse(res, 'done', { ok: true, cached: false, remaining: rate.remaining });
    return res.end();
  } catch (err) {
    console.error('[api/chat]', err);
    if (!res.headersSent) {
      return res.status(500).json({
        ok: false,
        message: 'Could not reach the docs assistant. Try /docs or /quickstart.',
      });
    }
    sendSse(res, 'error', { message: 'Could not complete the answer. Try /docs.' });
    return res.end();
  }
}
