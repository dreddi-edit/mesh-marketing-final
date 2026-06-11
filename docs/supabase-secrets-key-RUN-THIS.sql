-- COPY THIS ENTIRE FILE → Supabase SQL Editor → Run (one click, no edits)

create table if not exists public.mesh_operator_config (
  id int primary key default 1,
  secrets_key text not null,
  constraint mesh_operator_config_singleton check (id = 1)
);

alter table public.mesh_operator_config enable row level security;

create or replace function public.mesh_secrets_key()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select secrets_key from public.mesh_operator_config where id = 1 limit 1;
$$;

insert into public.mesh_operator_config (id, secrets_key)
values (1, 'HeAFrQusfOvgyBbqvQ8GRClvokMivberFZ+gzUm8xXc=')
on conflict (id) do update set secrets_key = excluded.secrets_key;
