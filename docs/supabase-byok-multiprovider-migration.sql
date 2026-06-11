-- Multi-provider BYOK + tested-model tracking
-- Run AFTER supabase-cli-settings-migration.sql + supabase-secrets-key-fix.sql

-- Generic per-provider encrypted keys + per-provider tested model list.
-- Schema:
--   provider_keys jsonb = {
--     google: { key_enc, model_allowlist: [ids], tested_models: [ids], updated_at },
--     openai: { key_enc, model_allowlist, tested_models, updated_at },
--     anthropic: { key_enc, ... },
--     openrouter: { key_enc, ... },
--     aws: { access_key_enc, secret_key_enc, region, ... },
--     azure: { key_enc, endpoint, deployment, ... }
--   }
--   custom_model_list jsonb = [ "mesh:google/gemini-3.5-flash", "openai/gpt-5", ... ]
--   activated_providers jsonb = [ "google", "openai" ]
alter table public.user_secrets
  add column if not exists provider_keys jsonb not null default '{}'::jsonb;
alter table public.user_secrets
  add column if not exists custom_model_list jsonb not null default '[]'::jsonb;
alter table public.user_secrets
  add column if not exists activated_providers jsonb not null default '[]'::jsonb;

create or replace function public.mesh_save_provider_key(
  p_provider text,
  p_key text,
  p_model_id text default null,
  p_marked_tested boolean default false,
  p_extra jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_existing public.user_secrets;
  v_provider_block jsonb;
  v_enc text;
  v_now bigint := (extract(epoch from now()) * 1000)::bigint;
  v_tested jsonb;
  v_allow jsonb;
begin
  if v_user is null then
    raise exception 'unauthenticated';
  end if;

  insert into public.user_secrets (user_id)
  values (v_user)
  on conflict (user_id) do nothing;

  select * into v_existing from public.user_secrets where user_id = v_user;
  v_provider_block := coalesce(v_existing.provider_keys -> p_provider, '{}'::jsonb);

  if p_key is not null and length(trim(p_key)) > 0 then
    v_enc := public.mesh_encrypt_secret(p_key);
    v_provider_block := v_provider_block || jsonb_build_object('key_enc', v_enc, 'updated_at', v_now);
  end if;

  if p_extra is not null and p_extra <> '{}'::jsonb then
    v_provider_block := v_provider_block || p_extra;
  end if;

  if p_marked_tested and p_model_id is not null then
    v_tested := coalesce(v_provider_block -> 'tested_models', '[]'::jsonb);
    if not (v_tested @> to_jsonb(p_model_id)) then
      v_tested := v_tested || to_jsonb(p_model_id);
    end if;
    v_allow := coalesce(v_provider_block -> 'model_allowlist', '[]'::jsonb);
    if not (v_allow @> to_jsonb(p_model_id)) then
      v_allow := v_allow || to_jsonb(p_model_id);
    end if;
    v_provider_block := v_provider_block || jsonb_build_object('tested_models', v_tested, 'model_allowlist', v_allow);
  end if;

  update public.user_secrets
  set
    provider_keys = jsonb_set(coalesce(provider_keys, '{}'::jsonb), array[p_provider], v_provider_block),
    activated_providers = (
      case
        when activated_providers @> to_jsonb(p_provider) then activated_providers
        else activated_providers || to_jsonb(p_provider)
      end
    ),
    secrets_updated_at = v_now
  where user_id = v_user;
end;
$$;

create or replace function public.mesh_delete_provider_key(p_provider text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_now bigint := (extract(epoch from now()) * 1000)::bigint;
begin
  if v_user is null then raise exception 'unauthenticated'; end if;
  update public.user_secrets
  set
    provider_keys = (provider_keys - p_provider),
    activated_providers = (
      select jsonb_agg(p) from jsonb_array_elements_text(activated_providers) as p
      where p <> p_provider
    ),
    secrets_updated_at = v_now
  where user_id = v_user;
end;
$$;

create or replace function public.mesh_get_provider_status()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_row public.user_secrets;
  v_out jsonb := '{}'::jsonb;
  v_provider text;
  v_block jsonb;
begin
  if v_user is null then raise exception 'unauthenticated'; end if;
  select * into v_row from public.user_secrets where user_id = v_user;
  if v_row is null then
    return jsonb_build_object('providers', '{}'::jsonb, 'activated', '[]'::jsonb, 'custom_model_list', '[]'::jsonb);
  end if;
  for v_provider, v_block in select * from jsonb_each(coalesce(v_row.provider_keys, '{}'::jsonb))
  loop
    v_out := v_out || jsonb_build_object(v_provider, jsonb_build_object(
      'has_key', (v_block ? 'key_enc') or (v_block ? 'access_key_enc'),
      'updated_at', v_block -> 'updated_at',
      'tested_models', coalesce(v_block -> 'tested_models', '[]'::jsonb),
      'model_allowlist', coalesce(v_block -> 'model_allowlist', '[]'::jsonb),
      'endpoint', v_block -> 'endpoint',
      'region', v_block -> 'region',
      'deployment', v_block -> 'deployment'
    ));
  end loop;
  return jsonb_build_object(
    'providers', v_out,
    'activated', coalesce(v_row.activated_providers, '[]'::jsonb),
    'custom_model_list', coalesce(v_row.custom_model_list, '[]'::jsonb)
  );
end;
$$;

create or replace function public.mesh_save_custom_model_list(p_list jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'unauthenticated'; end if;
  insert into public.user_secrets (user_id, custom_model_list)
  values (v_user, p_list)
  on conflict (user_id) do update set custom_model_list = excluded.custom_model_list;
end;
$$;

grant execute on function public.mesh_save_provider_key to authenticated;
grant execute on function public.mesh_delete_provider_key to authenticated;
grant execute on function public.mesh_get_provider_status to authenticated;
grant execute on function public.mesh_save_custom_model_list to authenticated;
