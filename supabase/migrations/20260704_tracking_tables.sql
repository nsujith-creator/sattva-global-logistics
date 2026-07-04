-- Tracking cache: stores ShipsGo API results for 24hr deduplication
create table if not exists public.tracking_cache (
  id         bigint generated always as identity primary key,
  cache_key  text not null,
  shipsgo_id integer,
  result_json jsonb not null,
  created_at timestamptz default now()
);
create index if not exists idx_tracking_cache_key_time
  on public.tracking_cache (cache_key, created_at desc);

-- Tracking leads: every gate submission
create table if not exists public.tracking_leads (
  id              bigint generated always as identity primary key,
  name            text not null,
  whatsapp        text not null,
  tracking_number text not null,
  carrier         text,
  cache_key       text not null,
  ip_hash         text,
  from_cache      boolean default false,
  created_at      timestamptz default now()
);
create index if not exists idx_tracking_leads_created
  on public.tracking_leads (created_at desc);

-- Block anon direct access; edge function uses service_role which bypasses RLS
alter table public.tracking_cache enable row level security;
alter table public.tracking_leads enable row level security;

create policy "service_role_only_cache" on public.tracking_cache
  using (false);
create policy "service_role_only_leads" on public.tracking_leads
  using (false);
