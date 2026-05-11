create table if not exists public.brocante_lists (
  key text primary key,
  items jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.brocante_lists enable row level security;

drop policy if exists "Allow public reads for brocante lists" on public.brocante_lists;
create policy "Allow public reads for brocante lists"
on public.brocante_lists
for select
to anon
using (key in ('brocante.sales.v1', 'brocante.estimates.v1', 'brocante.inventory.v1'));

drop policy if exists "Allow public writes for brocante lists" on public.brocante_lists;
create policy "Allow public writes for brocante lists"
on public.brocante_lists
for all
to anon
using (key in ('brocante.sales.v1', 'brocante.estimates.v1', 'brocante.inventory.v1'))
with check (key in ('brocante.sales.v1', 'brocante.estimates.v1', 'brocante.inventory.v1'));
