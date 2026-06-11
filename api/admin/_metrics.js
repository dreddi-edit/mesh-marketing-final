import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, setCors, verifyConsoleUser, requiredSupabaseEnvMissing } from './_lib.js';

async function npmInfo(pkg) {
  const [latest, downloads] = await Promise.allSettled([
    fetch(`https://registry.npmjs.org/${encodeURIComponent(pkg)}/latest`, {
      signal: AbortSignal.timeout(4000)
    })
      .then((r) => r.json())
      .then((d) => d.version),
    fetch(`https://api.npmjs.org/downloads/point/last-week/${encodeURIComponent(pkg)}`, {
      signal: AbortSignal.timeout(4000)
    })
      .then((r) => r.json())
      .then((d) => d.downloads)
  ]);
  return {
    version: latest.status === 'fulfilled' ? latest.value : null,
    weeklyDownloads: downloads.status === 'fulfilled' ? downloads.value : null
  };
}

function settleCheck(promise, fallbackName) {
  return promise.then(
    (value) => ({ ok: true, ...value, latencyMs: value.latencyMs ?? null }),
    (e) => ({
      name: fallbackName,
      ok: false,
      error: e?.message || 'check failed',
      latencyMs: null
    })
  );
}

async function buildStatusPayload() {
  const start = Date.now();

  const checks = await Promise.all([
    settleCheck(
      (async () => {
        const t0 = Date.now();
        const r = await fetch('https://mesh-llm.edgar-baumann.workers.dev/', {
          signal: AbortSignal.timeout(4000)
        });
        return { name: 'LLM Proxy', ok: r.status < 500, status: r.status, latencyMs: Date.now() - t0 };
      })(),
      'LLM Proxy'
    ),
    settleCheck(
      (async () => {
        const t0 = Date.now();
        const r = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
          headers: { apikey: process.env.SUPABASE_ANON_KEY ?? '' },
          signal: AbortSignal.timeout(4000)
        });
        return { name: 'Supabase Auth', ok: r.ok, status: r.status, latencyMs: Date.now() - t0 };
      })(),
      'Supabase Auth'
    ),
    settleCheck(
      (async () => {
        const t0 = Date.now();
        if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
          return {
            name: 'Supabase DB',
            ok: false,
            detail: 'SUPABASE_SERVICE_ROLE_KEY missing',
            latencyMs: Date.now() - t0
          };
        }
        const sb = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
          auth: { autoRefreshToken: false, persistSession: false }
        });
        const { count, error } = await sb.from('profiles').select('*', { count: 'exact', head: true });
        return {
          name: 'Supabase DB',
          ok: !error,
          rows: count ?? 0,
          detail: error?.message,
          latencyMs: Date.now() - t0
        };
      })(),
      'Supabase DB'
    ),
    settleCheck(
      (async () => {
        const t0 = Date.now();
        const d = await npmInfo('@trymesh/cli');
        return { name: 'npm @trymesh/cli', ok: !!d.version, ...d, latencyMs: Date.now() - t0 };
      })(),
      'npm @trymesh/cli'
    ),
    settleCheck(
      (async () => {
        const t0 = Date.now();
        const d = await npmInfo('@trymesh/mcp');
        return { name: 'npm @trymesh/mcp', ok: !!d.version, ...d, latencyMs: Date.now() - t0 };
      })(),
      'npm @trymesh/mcp'
    ),
    settleCheck(
      (async () => {
        const t0 = Date.now();
        const r = await fetch('https://try-mesh.com/', { signal: AbortSignal.timeout(4000) });
        return { name: 'try-mesh.com', ok: r.ok, status: r.status, latencyMs: Date.now() - t0 };
      })(),
      'try-mesh.com'
    ),
    settleCheck(
      (async () => {
        const t0 = Date.now();
        const r = await fetch('https://api.github.com/repos/dreddi-edit/mesh', {
          headers: { 'User-Agent': 'mesh-admin' },
          signal: AbortSignal.timeout(4000)
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const d = await r.json();
        return {
          name: 'GitHub dreddi-edit/mesh',
          ok: true,
          stars: d.stargazers_count,
          lastPush: d.pushed_at,
          latencyMs: Date.now() - t0
        };
      })(),
      'GitHub dreddi-edit/mesh'
    )
  ]);

  const totalMs = Date.now() - start;
  return {
    checks: checks.map((c) => ({
      ...c,
      latencyMs: c.latencyMs ?? totalMs
    })),
    timestamp: new Date().toISOString()
  };
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (requiredSupabaseEnvMissing()) {
    return res.status(503).json({ error: 'Admin Supabase environment is not configured' });
  }
  if (!(await verifyConsoleUser(req))) return res.status(401).json({ error: 'Unauthorized' });

  if (req.query?.action === 'status' || req.url?.includes('action=status')) {
    return res.status(200).json(await buildStatusPayload());
  }

  const sb = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const { data: events, error } = await sb
    .from('usage_events')
    .select('user_id, tokens_in, tokens_out, tokens_saved, created_at, cli_version, model_id');

  if (error) {
    const missingTable =
      error.code === '42P01' || error.code === 'PGRST205' || /usage_events/i.test(error.message ?? '');
    if (missingTable) {
      return res.status(200).json({
        perUser: [],
        totals: { sessions: 0, tokens_in: 0, tokens_out: 0, tokens_saved: 0, active_users_7d: 0 },
        warning: 'usage_events table is not available yet'
      });
    }
    return res.status(500).json({ error: error.message });
  }

  const byUser = {};
  const weekAgo = Date.now() - 7 * 86400_000;
  let totalIn = 0;
  let totalOut = 0;
  let totalSaved = 0;
  let totalSessions = 0;
  const activeUsers7d = new Set();

  for (const e of events ?? []) {
    if (!byUser[e.user_id]) {
      byUser[e.user_id] = {
        user_id: e.user_id,
        sessions: 0,
        tokens_in: 0,
        tokens_out: 0,
        tokens_saved: 0,
        last_active: null,
        sessions_this_week: 0,
        latest_cli: null,
        latest_model: null
      };
    }
    const u = byUser[e.user_id];
    u.sessions++;
    u.tokens_in += e.tokens_in ?? 0;
    u.tokens_out += e.tokens_out ?? 0;
    u.tokens_saved += e.tokens_saved ?? 0;
    if (!u.last_active || e.created_at > u.last_active) {
      u.last_active = e.created_at;
      u.latest_cli = e.cli_version;
      u.latest_model = e.model_id;
    }
    if (new Date(e.created_at).getTime() > weekAgo) {
      u.sessions_this_week++;
      activeUsers7d.add(e.user_id);
    }

    totalIn += e.tokens_in ?? 0;
    totalOut += e.tokens_out ?? 0;
    totalSaved += e.tokens_saved ?? 0;
    totalSessions++;
  }

  return res.status(200).json({
    perUser: Object.values(byUser),
    totals: {
      sessions: totalSessions,
      tokens_in: totalIn,
      tokens_out: totalOut,
      tokens_saved: totalSaved,
      active_users_7d: activeUsers7d.size
    }
  });
}
