-- Away — staff on courses and business trips (spec 2026-10-09-away-trips-design.md).
-- Sits ALONGSIDE leave, not inside it: exact times, amber warning only, and the
-- details are public (a work trip is not private, unlike a leave reason).
--
-- Number claimed 2026-10-12 against the live DB (highest remote 0063) and every
-- branch here and on origin: dev/main 0063, feat-job-stages (a parallel session,
-- local only) 0064 + 0065, everything else lower. 0066 is the next free number.

create table public.away_trips (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (length(trim(title)) > 0),
  business    text,
  location    text,
  start_date  date not null,
  start_time  time not null,
  end_date    date not null,
  end_time    time not null,
  note        text,
  created_by  uuid references public.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check ((end_date, end_time) > (start_date, start_time))
);

create index away_trips_range_idx on public.away_trips (start_date, end_date);

create table public.away_trip_people (
  trip_id  uuid not null references public.away_trips(id) on delete cascade,
  user_id  uuid not null references public.users(id) on delete cascade,
  primary key (trip_id, user_id)
);

create index away_trip_people_user_idx on public.away_trip_people (user_id);

alter table public.away_trips       enable row level security;
alter table public.away_trip_people enable row level security;

-- Everyone signed in reads: who is away and why is company-wide information.
create policy "away_trips: authenticated select"
  on public.away_trips for select to authenticated using (true);
create policy "away_trip_people: authenticated select"
  on public.away_trip_people for select to authenticated using (true);

-- Written by whoever manages leave (HR + admin today). can_manage_leave() from
-- 0058, so a future hr/finance split needs no change here.
create policy "away_trips: manage insert"
  on public.away_trips for insert to authenticated with check (can_manage_leave());
create policy "away_trips: manage update"
  on public.away_trips for update to authenticated
  using (can_manage_leave()) with check (can_manage_leave());
create policy "away_trips: manage delete"
  on public.away_trips for delete to authenticated using (can_manage_leave());

create policy "away_trip_people: manage insert"
  on public.away_trip_people for insert to authenticated with check (can_manage_leave());
create policy "away_trip_people: manage delete"
  on public.away_trip_people for delete to authenticated using (can_manage_leave());

-- Data API grants (CLAUDE.md hard rule, Supabase change of 2026-10-30). Never anon.
grant select, insert, update, delete on public.away_trips       to authenticated;
grant select, insert, update, delete on public.away_trips       to service_role;
grant select, insert, update, delete on public.away_trip_people to authenticated;
grant select, insert, update, delete on public.away_trip_people to service_role;

-- Realtime, so a trip HR adds appears on open schedules without a reload.
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and tablename = 'away_trips') then
    alter publication supabase_realtime add table away_trips;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and tablename = 'away_trip_people') then
    alter publication supabase_realtime add table away_trip_people;
  end if;
end $$;

alter table public.away_trips       replica identity full;
alter table public.away_trip_people replica identity full;
