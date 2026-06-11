import {
  setCors,
  verifyConsoleUser,
  requiredSupabaseEnvMissing,
  adminClient,
  getAdminEmails
} from './_lib.js';
import { OWNER_EMAIL, canAssignConsoleRole } from './_permissions.js';

async function listAllUsers(sb) {
  const users = [];
  let page = 1;
  const perPage = 200;

  while (page <= 10) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < perPage) break;
    page++;
  }

  return users;
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (requiredSupabaseEnvMissing()) {
    return res.status(503).json({
      error: 'Admin Supabase environment is not configured',
      code: 'env_missing',
      needs: ['SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY']
    });
  }

  // /api/admin/users?action=me — replaces the (removed) /api/admin/me
  // endpoint. Returns the current admin's role + permissions so the
  // console can paint its sidebar before any data fetch.
  if (req.method === 'GET' && (req.query?.action === 'me' || req.url?.includes('action=me'))) {
    const ctx = await verifyConsoleUser(req);
    if (!ctx) {
      return res.status(401).json({
        error: 'Unauthorized',
        code: 'not_admin',
        hint: 'No console role for this account. Ask an owner to grant admin, maintainer, or watcher.',
      });
    }
    return res.status(200).json({
      ok: true,
      email: ctx.user.email,
      role: ctx.role,
      permissions: ctx.permissions,
    });
  }

  const readCtx = await verifyConsoleUser(req);
  if (!readCtx) return res.status(401).json({ error: 'Unauthorized' });
  const sb = adminClient();

  if (req.method === 'GET') {
    try {
      const rawUsers = await listAllUsers(sb);
      let profiles = [];
      let profRes = await sb
        .from('profiles')
        .select('user_id, username, plan, first_name, last_name, admin_console_role');
      if (profRes.error && /admin_console_role/i.test(profRes.error.message ?? '')) {
        profRes = await sb
          .from('profiles')
          .select('user_id, username, plan, first_name, last_name');
      }
      if (profRes.error) throw profRes.error;
      profiles = profRes.data ?? [];
      const byId = Object.fromEntries(profiles.map((p) => [p.user_id, p]));

      const legacyAdmins = new Set(getAdminEmails());
      const users = rawUsers.map((u) => {
        const p = byId[u.id];
        const fullName = [p?.first_name, p?.last_name].filter(Boolean).join(' ');
        const email = String(u.email || '').toLowerCase();
        let console_role = null;
        if (email === OWNER_EMAIL) console_role = 'owner';
        else if (p?.admin_console_role) console_role = p.admin_console_role;
        else if (u.user_metadata?.admin_console_role) console_role = u.user_metadata.admin_console_role;
        else if (legacyAdmins.has(email)) console_role = 'admin';

        return {
          id: u.id,
          email: u.email,
          username: p?.username ?? null,
          first_name: p?.first_name ?? null,
          last_name: p?.last_name ?? null,
          plan: (p?.plan ?? 'basic').toLowerCase(),
          console_role,
          display_name: fullName || u.user_metadata?.display_name || u.user_metadata?.name || null,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at,
          confirmed: !!u.email_confirmed_at,
          provider: u.app_metadata?.provider ?? 'email'
        };
      });

      return res.status(200).json({ users, total: users.length });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  if (req.method === 'POST') {
    const writeCtx = await verifyConsoleUser(req, { requireWrite: true });
    if (!writeCtx) {
      return res.status(403).json({ error: 'Forbidden — read-only console role' });
    }

    const { action, userId, displayName, password } = req.body ?? {};
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const username = String(req.body?.username ?? '').trim();

    if (action === 'invite') {
      if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'valid email required' });
      const { data, error } = await sb.auth.admin.inviteUserByEmail(email, {
        redirectTo: 'https://try-mesh.com/admin'
      });
      if (error) return res.status(400).json({ error: error.message });
      if (username && data.user) {
        await sb.from('profiles').upsert({ user_id: data.user.id, username });
      }
      return res.status(200).json({ ok: true });
    }

    if (action === 'create') {
      if (!/^\S+@\S+\.\S+$/.test(email) || !password) {
        return res.status(400).json({ error: 'valid email and password required' });
      }
      const { data, error } = await sb.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: displayName ? { display_name: displayName } : {}
      });
      if (error) return res.status(400).json({ error: error.message });
      if (username && data.user) {
        await sb.from('profiles').upsert({ user_id: data.user.id, username });
      }
      return res.status(200).json({ ok: true });
    }

    if (action === 'update') {
      if (!userId) return res.status(400).json({ error: 'userId required' });
      const updates = {};
      if (email) {
        if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'valid email required' });
        updates.email = email;
      }
      if (displayName !== undefined) updates.user_metadata = { display_name: displayName };

      if (Object.keys(updates).length > 0) {
        const { error } = await sb.auth.admin.updateUserById(userId, updates);
        if (error) return res.status(400).json({ error: error.message });
      }
      if (username !== undefined) {
        if (username) {
          await sb.from('profiles').upsert({ user_id: userId, username });
        } else {
          await sb.from('profiles').delete().eq('user_id', userId);
        }
      }
      return res.status(200).json({ ok: true });
    }

    if (action === 'set-name') {
      if (!userId) return res.status(400).json({ error: 'userId required' });
      const firstName = String(req.body?.first_name ?? '').trim();
      const lastName = String(req.body?.last_name ?? '').trim();
      if (!firstName || !lastName) {
        return res.status(400).json({ error: 'first_name and last_name required' });
      }
      const { error } = await sb
        .from('profiles')
        .update({ first_name: firstName, last_name: lastName })
        .eq('user_id', userId);
      if (error) return res.status(400).json({ error: error.message });
      return res.status(200).json({ ok: true, first_name: firstName, last_name: lastName });
    }

    if (action === 'set-plan') {
      if (!userId) return res.status(400).json({ error: 'userId required' });
      const plan = String(req.body?.plan ?? '').trim().toLowerCase();
      if (!['basic', 'pro', 'ultra'].includes(plan)) {
        return res.status(400).json({ error: 'plan must be one of: basic, pro, ultra' });
      }
      // Try UPDATE first — Postgres INSERT ... ON CONFLICT validates NOT NULL
      // on the proposed INSERT row BEFORE the conflict resolver runs, so
      // upsert here would trip on profiles.username NOT NULL whenever the
      // current row lacks a username. UPDATE never validates that path.
      const { data: updated, error: updErr } = await sb
        .from('profiles')
        .update({ plan })
        .eq('user_id', userId)
        .select('user_id');
      if (updErr) return res.status(400).json({ error: updErr.message });

      if (!updated || updated.length === 0) {
        // No row to update — INSERT a fresh one. Derive a username from the
        // auth.users.email (local-part), since the column is NOT NULL.
        const { data: userLookup, error: userErr } = await sb.auth.admin.getUserById(userId);
        if (userErr || !userLookup?.user) {
          return res.status(404).json({ error: 'user not found' });
        }
        const fallbackUsername = (userLookup.user.email || '').split('@')[0] || `user-${userId.slice(0, 8)}`;
        const { error: insErr } = await sb
          .from('profiles')
          .insert({ user_id: userId, plan, username: fallbackUsername });
        if (insErr) return res.status(400).json({ error: insErr.message });
      }
      return res.status(200).json({ ok: true, plan });
    }

    if (action === 'reset-password') {
      if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'valid email required' });
      const { error } = await sb.auth.resetPasswordForEmail(email, {
        redirectTo: 'https://try-mesh.com/admin'
      });
      if (error) return res.status(400).json({ error: error.message });
      return res.status(200).json({ ok: true });
    }

    if (action === 'set-console-role') {
      if (!userId) return res.status(400).json({ error: 'userId required' });
      const rawRole = String(req.body?.consoleRole ?? req.body?.role ?? '').trim().toLowerCase();
      const targetRole = rawRole === 'none' || rawRole === '' ? null : rawRole;

      if (targetRole === 'owner') {
        return res.status(400).json({ error: 'Owner role cannot be assigned' });
      }
      if (targetRole && !['admin', 'maintainer', 'watcher'].includes(targetRole)) {
        return res.status(400).json({ error: 'Invalid console role' });
      }
      if (!canAssignConsoleRole(writeCtx.role, targetRole || 'none')) {
        return res.status(403).json({ error: 'Not allowed to assign this role' });
      }

      const { data: targetUser, error: userErr } = await sb.auth.admin.getUserById(userId);
      if (userErr || !targetUser?.user) return res.status(404).json({ error: 'user not found' });
      if (String(targetUser.user.email || '').toLowerCase() === OWNER_EMAIL) {
        return res.status(400).json({ error: 'Owner account role is fixed' });
      }

      const { data: updated, error: updErr } = await sb
        .from('profiles')
        .update({ admin_console_role: targetRole })
        .eq('user_id', userId)
        .select('user_id');

      // Fallback when the admin_console_role column hasn't been migrated yet:
      // store the role in auth.users.user_metadata.admin_console_role so role
      // changes work immediately without requiring an SQL migration first.
      const columnMissing = updErr && /admin_console_role/i.test(updErr.message ?? '');
      if (columnMissing) {
        const meta = { ...(targetUser.user.user_metadata ?? {}), admin_console_role: targetRole };
        const { error: metaErr } = await sb.auth.admin.updateUserById(userId, { user_metadata: meta });
        if (metaErr) return res.status(400).json({ error: metaErr.message });
        return res.status(200).json({ ok: true, console_role: targetRole, storage: 'user_metadata' });
      }
      if (updErr) return res.status(400).json({ error: updErr.message });

      if (!updated?.length) {
        const fallbackUsername =
          (targetUser.user.email || '').split('@')[0] || `user-${userId.slice(0, 8)}`;
        const insertPayload = { user_id: userId, username: fallbackUsername, plan: 'basic', admin_console_role: targetRole };
        const { error: insErr } = await sb.from('profiles').insert(insertPayload);
        if (insErr && /admin_console_role/i.test(insErr.message ?? '')) {
          // Same fallback for insert path
          const meta = { ...(targetUser.user.user_metadata ?? {}), admin_console_role: targetRole };
          const { error: metaErr } = await sb.auth.admin.updateUserById(userId, { user_metadata: meta });
          if (metaErr) return res.status(400).json({ error: metaErr.message });
          return res.status(200).json({ ok: true, console_role: targetRole, storage: 'user_metadata' });
        }
        if (insErr) return res.status(400).json({ error: insErr.message });
      }
      return res.status(200).json({ ok: true, console_role: targetRole });
    }

    return res.status(400).json({ error: 'Unknown action' });
  }

  if (req.method === 'DELETE') {
    const writeCtx = await verifyConsoleUser(req, { requireWrite: true });
    if (!writeCtx) {
      return res.status(403).json({ error: 'Forbidden — read-only console role' });
    }
    const userId = req.body?.userId || req.query?.userId;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const { error } = await sb.auth.admin.deleteUser(userId);
    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
