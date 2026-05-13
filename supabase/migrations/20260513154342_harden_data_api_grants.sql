begin;

-- Preserve row level security on every public table in this access model.
alter table public.otp_challenges enable row level security;
alter table public.verified_sessions enable row level security;
alter table public.quote_requests enable row level security;
alter table public.search_logs enable row level security;
alter table public.quotes enable row level security;
alter table public.rates enable row level security;
alter table public.trade_advisory enable row level security;

-- Private tables: reachable only through Edge Functions using SERVICE_ROLE_KEY.
revoke all privileges on table
  public.otp_challenges,
  public.verified_sessions,
  public.quote_requests,
  public.search_logs,
  public.quotes,
  public.rates
from anon, authenticated;

grant select, insert, update, delete on table
  public.otp_challenges,
  public.verified_sessions,
  public.quote_requests,
  public.search_logs,
  public.quotes,
  public.rates
to service_role;

-- Public table: browser may read advisory content directly; writes stay privileged.
revoke insert, update, delete on table public.trade_advisory from anon, authenticated;
grant select on table public.trade_advisory to anon, authenticated;
grant select, insert, update, delete on table public.trade_advisory to service_role;

-- Replace trade_advisory policies with explicit public read + service write intent.
drop policy if exists "public_read_advisory" on public.trade_advisory;
drop policy if exists "service_write_advisory" on public.trade_advisory;
drop policy if exists "trade_advisory_public_read" on public.trade_advisory;
drop policy if exists "trade_advisory_service_all" on public.trade_advisory;

create policy "trade_advisory_public_read"
on public.trade_advisory
for select
to anon, authenticated
using (true);

create policy "trade_advisory_service_all"
on public.trade_advisory
for all
to service_role
using (true)
with check (true);

-- Private tables: explicit service-only policies make the RLS intent visible to
-- Supabase Security Advisor while anon/authenticated table grants remain absent.
drop policy if exists "otp_challenges_service_only" on public.otp_challenges;
create policy "otp_challenges_service_only"
on public.otp_challenges
for all
to service_role
using (true)
with check (true);

drop policy if exists "verified_sessions_service_only" on public.verified_sessions;
create policy "verified_sessions_service_only"
on public.verified_sessions
for all
to service_role
using (true)
with check (true);

drop policy if exists "quote_requests_service_only" on public.quote_requests;
create policy "quote_requests_service_only"
on public.quote_requests
for all
to service_role
using (true)
with check (true);

drop policy if exists "search_logs_service_only" on public.search_logs;
create policy "search_logs_service_only"
on public.search_logs
for all
to service_role
using (true)
with check (true);

drop policy if exists "quotes_service_only" on public.quotes;
create policy "quotes_service_only"
on public.quotes
for all
to service_role
using (true)
with check (true);

drop policy if exists "rates_service_only" on public.rates;
create policy "rates_service_only"
on public.rates
for all
to service_role
using (true)
with check (true);

commit;
