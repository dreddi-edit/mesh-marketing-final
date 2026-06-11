-- Admin console roles on profiles (run once in Supabase SQL editor)
--
-- Roles: owner | admin | maintainer | watcher (null = no console access)
-- Owner is enforced in API for edgar@mailbaumann.de only — do not assign owner in DB.

alter table public.profiles
  add column if not exists admin_console_role text;

alter table public.profiles
  drop constraint if exists profiles_admin_console_role_check;

alter table public.profiles
  add constraint profiles_admin_console_role_check
  check (
    admin_console_role is null
    or admin_console_role in ('admin', 'maintainer', 'watcher')
  );

-- Seed owner account metadata (role resolved in API; column optional)
update public.profiles p
set admin_console_role = 'admin'
from auth.users u
where p.user_id = u.id
  and lower(u.email) = 'edgar.baumann@try-mesh.com'
  and p.admin_console_role is null;
