create table public.clients (
  id   uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table public.client_contacts (
  id        uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  name      text not null
);

-- Seed company names from existing job data
insert into public.clients (name)
select distinct client from public.jobs
where client is not null and client <> ''
on conflict (name) do nothing;

alter table public.clients enable row level security;
alter table public.client_contacts enable row level security;

create policy "authenticated read clients"
  on public.clients for select to authenticated using (true);
create policy "authenticated insert clients"
  on public.clients for insert to authenticated with check (true);
create policy "authenticated delete clients"
  on public.clients for delete to authenticated using (true);

create policy "authenticated read client_contacts"
  on public.client_contacts for select to authenticated using (true);
create policy "authenticated insert client_contacts"
  on public.client_contacts for insert to authenticated with check (true);
create policy "authenticated delete client_contacts"
  on public.client_contacts for delete to authenticated using (true);
