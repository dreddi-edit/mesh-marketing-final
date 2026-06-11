/** Console RBAC — owner is fixed to a single email; never stored on other users. */

export const OWNER_EMAIL = 'edgar@mailbaumann.de';
export const CONSOLE_ROLES = ['owner', 'admin', 'maintainer', 'watcher'];

const ROLE_RANK = { owner: 4, admin: 3, maintainer: 2, watcher: 1 };

export function roleRank(role) {
  return ROLE_RANK[role] ?? 0;
}

export function permissionsFor(role) {
  const rank = roleRank(role);
  return {
    role,
    canRead: rank >= 1,
    canWrite: rank >= 3,
    canManageConsoleRoles: rank >= 3,
    canBroadcastWaitlist: rank >= 3,
    canRemoveWaitlist: rank >= 3
  };
}

export function canAssignConsoleRole(actorRole, targetRole) {
  if (!targetRole || targetRole === 'none') return roleRank(actorRole) >= 3;
  if (targetRole === 'owner') return false;
  if (actorRole === 'owner') return ['admin', 'maintainer', 'watcher'].includes(targetRole);
  if (actorRole === 'admin') return ['admin', 'maintainer', 'watcher'].includes(targetRole);
  return false;
}

/**
 * Resolve effective console role: owner email always wins; then DB column; then env allowlist → admin.
 */
export async function resolveConsoleRole(sb, user, legacyAdminEmails = []) {
  const email = String(user?.email || '')
    .trim()
    .toLowerCase();
  if (!email) return null;
  if (email === OWNER_EMAIL) return 'owner';

  let fromDb = null;
  try {
    const { data: profile } = await sb
      .from('profiles')
      .select('admin_console_role')
      .eq('user_id', user.id)
      .maybeSingle();
    fromDb = profile?.admin_console_role;
  } catch {
    // column may not exist until migration runs
  }

  if (fromDb === 'owner') return 'owner';
  if (fromDb && CONSOLE_ROLES.includes(fromDb) && fromDb !== 'owner') return fromDb;

  // Fallback storage in auth.users.user_metadata for environments where the
  // profiles.admin_console_role column hasn't been migrated yet.
  const fromMeta = user?.user_metadata?.admin_console_role;
  if (fromMeta && CONSOLE_ROLES.includes(fromMeta) && fromMeta !== 'owner') return fromMeta;

  if (legacyAdminEmails.includes(email)) return 'admin';
  return null;
}
