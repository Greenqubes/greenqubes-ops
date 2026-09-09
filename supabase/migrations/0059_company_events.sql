-- Company events — multi-day things the whole company should see on the
-- schedule: a retreat, a shutdown, a town hall (Nic, 2026-09-08: "hr needs to
-- input on any days for like an event let's say company retreat 5-9 Aug so on
-- schedule it'll show those 5 days ... much like public holiday").
--
-- Separate from public_holidays on purpose, despite looking similar on screen:
--   * a holiday is ONE gazetted date; an event is a RANGE
--   * a holiday is a fact about Singapore; an event is a fact about this company
-- Merging them would mean a nullable end date and a "which kind is this?"
-- column on every row and every screen, for no gain.
--
-- Label-only, exactly like holidays: it does NOT warn or block when someone
-- schedules a job during it. (Leave is the thing that warns.)
--
-- Number claimed 2026-09-08 against the live DB (highest remote 0056) and
-- every branch here and on origin: dev/main 0056, this branch 0057+0058,
-- feat-voice-pa 0053, feat-provision* 0052, dev-bryan 0030. Written as its
-- OWN file rather than folded into the unapplied 0058, because 0058 may be
-- applied at any moment and a later edit to it would be silently skipped.

create table public.company_events (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  date_start  date not null,
  date_end    date not null,
  created_by  uuid references public.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (date_end >= date_start)
);

create index company_events_range_idx on public.company_events (date_start, date_end);

alter table public.company_events enable row level security;

-- Everyone reads: this is company-wide information, shown on every role's
-- schedule (the same call Nic made for leave and holidays on 2026-09-08).
create policy "events: authenticated select"
  on public.company_events for select to authenticated
  using (true);

-- Written by whoever manages leave — HR today. Reuses can_manage_leave() from
-- 0058 so a future hr/finance split needs no change here.
create policy "events: manage insert"
  on public.company_events for insert to authenticated
  with check (can_manage_leave());

create policy "events: manage update"
  on public.company_events for update to authenticated
  using (can_manage_leave())
  with check (can_manage_leave());

create policy "events: manage delete"
  on public.company_events for delete to authenticated
  using (can_manage_leave());

-- Realtime, so an event added by HR appears on open schedules without a reload.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'company_events'
  ) then
    alter publication supabase_realtime add table company_events;
  end if;
end $$;

alter table public.company_events replica identity full;
