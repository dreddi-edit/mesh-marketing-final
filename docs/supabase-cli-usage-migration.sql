-- Mesh CLI usage tracking — run once in the Supabase SQL editor.
--
-- Schema: a single row per user holding the rolling totals + per-model breakdown
-- for the CURRENT period. Rotated monthly by `period_start`. The CLI upserts
-- this row after every turn (best-effort, network-failure-tolerant).
--
-- Why per-user totals instead of a per-request log: account-page reads stay
-- O(1), no aggregation needed in the UI, and KV/D1 isn't required. Per-request
-- logs can be added later if forensic detail is needed.

create table if not exists public.cli_usage_summary (
  user_id uuid primary key references auth.users(id) on delete cascade,
  updated_at timestamptz not null default now(),
  -- start of the current billing/usage period (rotated monthly by the CLI)
  period_start timestamptz not null default now(),
  -- per-model breakdown:
  --   { [modelId]: { requests, inputTokens, outputTokens, savedTokens, savedUsd, costUsd } }
  by_model jsonb not null default '{}'::jsonb,
  total_requests int not null default 0,
  total_input_tokens bigint not null default 0,
  total_output_tokens bigint not null default 0,
  total_saved_tokens bigint not null default 0,
  total_saved_usd numeric(12, 4) not null default 0,
  total_cost_usd numeric(12, 4) not null default 0
);

create index if not exists cli_usage_summary_updated_idx
  on public.cli_usage_summary (updated_at desc);

-- RLS: users can only see/edit their own row.
alter table public.cli_usage_summary enable row level security;

drop policy if exists "users read own cli usage" on public.cli_usage_summary;
create policy "users read own cli usage"
  on public.cli_usage_summary for select
  using (auth.uid() = user_id);

drop policy if exists "users upsert own cli usage" on public.cli_usage_summary;
create policy "users upsert own cli usage"
  on public.cli_usage_summary for insert
  with check (auth.uid() = user_id);

drop policy if exists "users update own cli usage" on public.cli_usage_summary;
create policy "users update own cli usage"
  on public.cli_usage_summary for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Optional helper: atomic "add to running totals" RPC. Avoids the
-- read-modify-write race the CLI would otherwise hit on parallel sessions.
create or replace function public.append_cli_usage(
  p_user_id uuid,
  p_model_id text,
  p_input_tokens int,
  p_output_tokens int,
  p_saved_tokens int,
  p_saved_usd numeric,
  p_cost_usd numeric
) returns void
language plpgsql
security definer
as $$
declare
  v_existing public.cli_usage_summary;
  v_now timestamptz := now();
  v_model jsonb;
begin
  select * into v_existing
  from public.cli_usage_summary
  where user_id = p_user_id;

  -- Rotate the period if it's older than 30 days.
  if v_existing.user_id is null or v_now - v_existing.period_start > interval '30 days' then
    insert into public.cli_usage_summary (
      user_id, updated_at, period_start, by_model,
      total_requests, total_input_tokens, total_output_tokens,
      total_saved_tokens, total_saved_usd, total_cost_usd
    ) values (
      p_user_id, v_now, v_now,
      jsonb_build_object(p_model_id, jsonb_build_object(
        'requests', 1,
        'inputTokens', p_input_tokens,
        'outputTokens', p_output_tokens,
        'savedTokens', p_saved_tokens,
        'savedUsd', p_saved_usd,
        'costUsd', p_cost_usd
      )),
      1, p_input_tokens, p_output_tokens, p_saved_tokens, p_saved_usd, p_cost_usd
    )
    on conflict (user_id) do update set
      updated_at = v_now,
      period_start = v_now,
      by_model = excluded.by_model,
      total_requests = 1,
      total_input_tokens = excluded.total_input_tokens,
      total_output_tokens = excluded.total_output_tokens,
      total_saved_tokens = excluded.total_saved_tokens,
      total_saved_usd = excluded.total_saved_usd,
      total_cost_usd = excluded.total_cost_usd;
    return;
  end if;

  -- Merge into existing model breakdown
  v_model := coalesce(v_existing.by_model -> p_model_id, '{}'::jsonb);
  v_model := jsonb_build_object(
    'requests', coalesce((v_model->>'requests')::int, 0) + 1,
    'inputTokens', coalesce((v_model->>'inputTokens')::int, 0) + p_input_tokens,
    'outputTokens', coalesce((v_model->>'outputTokens')::int, 0) + p_output_tokens,
    'savedTokens', coalesce((v_model->>'savedTokens')::int, 0) + p_saved_tokens,
    'savedUsd', coalesce((v_model->>'savedUsd')::numeric, 0) + p_saved_usd,
    'costUsd', coalesce((v_model->>'costUsd')::numeric, 0) + p_cost_usd
  );

  update public.cli_usage_summary
  set
    updated_at = v_now,
    by_model = jsonb_set(coalesce(by_model, '{}'::jsonb), array[p_model_id], v_model),
    total_requests = total_requests + 1,
    total_input_tokens = total_input_tokens + p_input_tokens,
    total_output_tokens = total_output_tokens + p_output_tokens,
    total_saved_tokens = total_saved_tokens + p_saved_tokens,
    total_saved_usd = total_saved_usd + p_saved_usd,
    total_cost_usd = total_cost_usd + p_cost_usd
  where user_id = p_user_id;
end;
$$;

grant execute on function public.append_cli_usage to authenticated;
