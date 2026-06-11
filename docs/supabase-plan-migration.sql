-- Mesh plan + profile migration
--
-- Run this once in the Supabase SQL Editor for project `mesh-cache`:
-- https://supabase.com/dashboard/project/msmonxiacxhendxehezw/sql/new
--
-- What it does:
--   1. Adds `plan` (basic | pro | ultra, default basic) +
--      `first_name` + `last_name` columns to `profiles`.
--   2. Trigger so every new `auth.users` row gets a matching
--      `profiles` row with plan=basic. Pulls first/last name from
--      auth.users.raw_user_meta_data (Google: given_name/family_name,
--      GitHub: name split, password signup: first_name/last_name).
--   3. Backfills existing auth.users that lack a profile entry,
--      same name-derivation.
--   4. RLS policies so signed-in users can read + update THEIR OWN
--      profile row (needed for /auth/welcome and the "complete profile"
--      form). Service-role bypasses RLS so the admin dashboard still
--      reads + writes everything.
--
-- Idempotent: safe to re-run after schema changes.

-- 1) Columns
alter table public.profiles
  add column if not exists plan text not null default 'basic';
alter table public.profiles
  add column if not exists first_name text;
alter table public.profiles
  add column if not exists last_name text;

-- Enforce allowed values. drop+add so re-runs don't error on the dup constraint.
alter table public.profiles
  drop constraint if exists profiles_plan_check;
alter table public.profiles
  add constraint profiles_plan_check
  check (plan in ('basic', 'pro', 'ultra'));

-- 2) Trigger: new auth.users → profiles row.
-- Username derivation: email local-part (fallback: short uuid).
-- Name derivation: explicit keys first (first_name/last_name), then
-- Google's claims (given_name/family_name), then GitHub-style name split.
-- Wrapped in `exception when others` so a profiles glitch never blocks
-- the underlying signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  derived_username text;
  derived_first text;
  derived_last text;
  meta jsonb;
  full_name text;
  space_pos int;
begin
  meta := coalesce(new.raw_user_meta_data, '{}'::jsonb);

  derived_username := coalesce(
    nullif(meta->>'username', ''),
    nullif(split_part(new.email, '@', 1), ''),
    'user-' || substring(new.id::text from 1 for 8)
  );

  -- Prefer explicit first/last name, then OAuth claim names.
  derived_first := coalesce(
    nullif(meta->>'first_name', ''),
    nullif(meta->>'given_name', '')
  );
  derived_last := coalesce(
    nullif(meta->>'last_name', ''),
    nullif(meta->>'family_name', '')
  );

  -- If still missing, fall back to splitting a single "name" field
  -- (GitHub returns the full display name there).
  if derived_first is null or derived_last is null then
    full_name := nullif(meta->>'name', '');
    if full_name is not null then
      space_pos := position(' ' in full_name);
      if space_pos > 0 then
        derived_first := coalesce(derived_first, trim(substring(full_name from 1 for space_pos - 1)));
        derived_last := coalesce(derived_last, trim(substring(full_name from space_pos + 1)));
      else
        derived_first := coalesce(derived_first, full_name);
      end if;
    end if;
  end if;

  insert into public.profiles (user_id, plan, username, first_name, last_name)
  values (new.id, 'basic', derived_username, derived_first, derived_last)
  on conflict (user_id) do nothing;
  return new;
exception when others then
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 3) Backfill: any existing auth.users without a profile entry.
-- Same derivation as the trigger above, written as a single insert
-- by leaning on jsonb extraction inline.
insert into public.profiles (user_id, plan, username, first_name, last_name)
select
  u.id,
  'basic',
  coalesce(
    nullif(coalesce(u.raw_user_meta_data, '{}'::jsonb)->>'username', ''),
    nullif(split_part(u.email, '@', 1), ''),
    'user-' || substring(u.id::text from 1 for 8)
  ),
  -- first name
  coalesce(
    nullif(coalesce(u.raw_user_meta_data, '{}'::jsonb)->>'first_name', ''),
    nullif(coalesce(u.raw_user_meta_data, '{}'::jsonb)->>'given_name', ''),
    case
      when position(' ' in coalesce(u.raw_user_meta_data->>'name', '')) > 0
        then trim(substring(u.raw_user_meta_data->>'name' from 1 for position(' ' in u.raw_user_meta_data->>'name') - 1))
      else nullif(u.raw_user_meta_data->>'name', '')
    end
  ),
  -- last name
  coalesce(
    nullif(coalesce(u.raw_user_meta_data, '{}'::jsonb)->>'last_name', ''),
    nullif(coalesce(u.raw_user_meta_data, '{}'::jsonb)->>'family_name', ''),
    case
      when position(' ' in coalesce(u.raw_user_meta_data->>'name', '')) > 0
        then trim(substring(u.raw_user_meta_data->>'name' from position(' ' in u.raw_user_meta_data->>'name') + 1))
      else null
    end
  )
from auth.users u
left join public.profiles p on p.user_id = u.id
where p.user_id is null
on conflict (user_id) do nothing;

-- 4) RLS policies
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_self_read'
  ) then
    create policy "profiles_self_read"
      on public.profiles for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_self_update'
  ) then
    -- Lets a signed-in user write THEIR OWN first_name/last_name from
    -- /auth/welcome. The check guards against changing user_id; admins
    -- still go through service-role which bypasses RLS.
    create policy "profiles_self_update"
      on public.profiles for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end$$;

-- Done. After running this:
--  · /auth/welcome can read + update first_name / last_name
--  · /admin can show + edit plan
--  · new OAuth signups get name fields pre-populated from the provider
