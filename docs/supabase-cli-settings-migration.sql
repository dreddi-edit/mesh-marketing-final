-- CLI settings + BYOK secrets (run once in Supabase SQL editor)
-- Project: msmonxiacxhendxehezw

create extension if not exists pgcrypto;

create table if not exists public.mesh_operator_config (
  id int primary key default 1,
  secrets_key text not null,
  constraint mesh_operator_config_singleton check (id = 1)
);
alter table public.mesh_operator_config enable row level security;

-- 1) Account preferences (no API keys in this JSON)
alter table public.profiles
  add column if not exists cli_settings jsonb not null default '{}'::jsonb;
alter table public.profiles
  add column if not exists cli_settings_updated_at bigint not null default 0;

-- 2) Encrypted BYOK secrets (one row per user)
create table if not exists public.user_secrets (
  user_id uuid primary key references auth.users (id) on delete cascade,
  google_api_key_enc text,
  nvidia_api_key_enc text,
  google_model_allowlist jsonb not null default '[]'::jsonb,
  secrets_updated_at bigint not null default 0
);

alter table public.user_secrets enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_secrets' and policyname = 'user_secrets_self_read'
  ) then
    create policy "user_secrets_self_read"
      on public.user_secrets for select
      using (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_secrets' and policyname = 'user_secrets_self_write'
  ) then
    create policy "user_secrets_self_write"
      on public.user_secrets for insert
      with check (auth.uid() = user_id);
    create policy "user_secrets_self_update"
      on public.user_secrets for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end$$;

-- Encryption key: hosted Supabase cannot set app.settings.mesh_secrets_key on
-- authenticator (permission denied). Run supabase-secrets-key-fix.sql instead.

create or replace function public.mesh_secrets_key()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select secrets_key from public.mesh_operator_config where id = 1 limit 1;
$$;

create or replace function public.mesh_encrypt_secret(p_plain text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  k text;
begin
  if p_plain is null or length(trim(p_plain)) = 0 then
    return null;
  end if;
  k := mesh_secrets_key();
  if k is null then
    raise exception 'mesh_secrets_key not configured';
  end if;
  return encode(pgp_sym_encrypt(p_plain, k), 'base64');
end;
$$;

create or replace function public.mesh_decrypt_secret(p_enc text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  k text;
begin
  if p_enc is null or length(trim(p_enc)) = 0 then
    return null;
  end if;
  k := mesh_secrets_key();
  if k is null then
    raise exception 'mesh_secrets_key not configured';
  end if;
  return pgp_sym_decrypt(decode(p_enc, 'base64'), k);
end;
$$;

-- Save BYOK from /account (authenticated user only)
create or replace function public.mesh_save_user_secrets(
  p_google_key text default null,
  p_nvidia_key text default null,
  p_google_models jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  enc_google text;
  enc_nvidia text;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  enc_google := case when p_google_key is not null and length(trim(p_google_key)) > 0
    then mesh_encrypt_secret(trim(p_google_key)) else null end;
  enc_nvidia := case when p_nvidia_key is not null and length(trim(p_nvidia_key)) > 0
    then mesh_encrypt_secret(trim(p_nvidia_key)) else null end;

  insert into public.user_secrets (user_id, google_api_key_enc, nvidia_api_key_enc, google_model_allowlist, secrets_updated_at)
  values (
    uid,
    enc_google,
    enc_nvidia,
    coalesce(p_google_models, '[]'::jsonb),
    (extract(epoch from now()) * 1000)::bigint
  )
  on conflict (user_id) do update set
    google_api_key_enc = coalesce(excluded.google_api_key_enc, user_secrets.google_api_key_enc),
    nvidia_api_key_enc = coalesce(excluded.nvidia_api_key_enc, user_secrets.nvidia_api_key_enc),
    google_model_allowlist = case
      when p_google_models is not null then excluded.google_model_allowlist
      else user_secrets.google_model_allowlist
    end,
    secrets_updated_at = excluded.secrets_updated_at;
end;
$$;

-- Metadata for /account UI (no plaintext keys)
create or replace function public.mesh_user_secrets_meta()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  row public.user_secrets%rowtype;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  select * into row from public.user_secrets where user_id = uid;
  if not found then
    return jsonb_build_object(
      'has_google_key', false,
      'has_nvidia_key', false,
      'google_model_allowlist', '[]'::jsonb,
      'secrets_updated_at', 0
    );
  end if;
  return jsonb_build_object(
    'has_google_key', row.google_api_key_enc is not null,
    'has_nvidia_key', row.nvidia_api_key_enc is not null,
    'google_model_allowlist', coalesce(row.google_model_allowlist, '[]'::jsonb),
    'secrets_updated_at', row.secrets_updated_at
  );
end;
$$;

-- CLI pulls decrypted secrets on `mesh` start (authenticated only)
create or replace function public.mesh_fetch_user_secrets_for_cli()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  row public.user_secrets%rowtype;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  select * into row from public.user_secrets where user_id = uid;
  if not found then
    return jsonb_build_object('google_api_key', null, 'nvidia_api_key', null, 'google_model_allowlist', '[]'::jsonb);
  end if;
  return jsonb_build_object(
    'google_api_key', mesh_decrypt_secret(row.google_api_key_enc),
    'nvidia_api_key', mesh_decrypt_secret(row.nvidia_api_key_enc),
    'google_model_allowlist', coalesce(row.google_model_allowlist, '[]'::jsonb)
  );
end;
$$;

grant execute on function public.mesh_save_user_secrets(text, text, jsonb) to authenticated;
grant execute on function public.mesh_user_secrets_meta() to authenticated;
grant execute on function public.mesh_fetch_user_secrets_for_cli() to authenticated;
