-- Run this AFTER supabase-cli-settings-migration.sql
-- Supabase hosted does not allow: alter role authenticator set app.settings.mesh_secrets_key
-- Use a one-row operator table instead (only security-definer RPCs read it).

create table if not exists public.mesh_operator_config (
  id int primary key default 1,
  secrets_key text not null,
  constraint mesh_operator_config_singleton check (id = 1)
);

alter table public.mesh_operator_config enable row level security;
-- No policies → anon/authenticated cannot read the key via PostgREST.

create or replace function public.mesh_secrets_key()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select secrets_key from public.mesh_operator_config where id = 1 limit 1;
$$;

-- Replace your placeholder with the output of: openssl rand -base64 32
insert into public.mesh_operator_config (id, secrets_key)
values (1, 'PASTE-YOUR-RANDOM-KEY-HERE')
on conflict (id) do update set secrets_key = excluded.secrets_key;
