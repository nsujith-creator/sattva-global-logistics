-- Approved tracking users: only these WhatsApp numbers can spend ShipsGo credits.
-- Manage rows directly in Supabase Table Editor. Match is on last 10 digits.
create table if not exists public.approved_tracking_users (
  id         bigint generated always as identity primary key,
  whatsapp   text not null,        -- store last-10-digit form, e.g. 9136121123
  name       text,
  notes      text,                 -- e.g. "Addis Paint / Natnael", "internal"
  status     text not null default 'approved',  -- approved | blocked
  created_at timestamptz default now()
);
create unique index if not exists idx_approved_whatsapp
  on public.approved_tracking_users (whatsapp);

alter table public.approved_tracking_users enable row level security;
create policy "service_role_only_approved" on public.approved_tracking_users
  using (false);

-- Seed: Sujith's own number for testing
insert into public.approved_tracking_users (whatsapp, name, notes)
values ('9136121123', 'Sujith', 'internal')
on conflict (whatsapp) do nothing;
