create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique default upper(substr(encode(gen_random_bytes(5), 'hex'), 1, 10)),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'brocante_lists'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'brocante_lists'
      and column_name = 'team_id'
  ) then
    alter table public.brocante_lists rename to brocante_lists_legacy;
  end if;
end $$;

create table if not exists public.brocante_lists (
  team_id uuid not null references public.teams(id) on delete cascade,
  key text not null check (key in ('brocante.sales.v1', 'brocante.estimates.v1', 'brocante.inventory.v1')),
  items jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (team_id, key)
);

alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.brocante_lists enable row level security;

create or replace function public.is_team_member(target_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.team_members
    where team_id = target_team_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.create_team(team_name text)
returns public.teams
language plpgsql
security definer
set search_path = public
as $$
declare
  created_team public.teams;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.teams (name, created_by)
  values (nullif(trim(team_name), ''), auth.uid())
  returning * into created_team;

  insert into public.team_members (team_id, user_id, role)
  values (created_team.id, auth.uid(), 'owner');

  return created_team;
end;
$$;

create or replace function public.join_team(invite text)
returns public.teams
language plpgsql
security definer
set search_path = public
as $$
declare
  target_team public.teams;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into target_team
  from public.teams
  where invite_code = upper(trim(invite));

  if target_team.id is null then
    raise exception 'Invalid invite code';
  end if;

  insert into public.team_members (team_id, user_id, role)
  values (target_team.id, auth.uid(), 'member')
  on conflict (team_id, user_id) do nothing;

  return target_team;
end;
$$;

grant execute on function public.is_team_member(uuid) to authenticated;
grant execute on function public.create_team(text) to authenticated;
grant execute on function public.join_team(text) to authenticated;

drop policy if exists "Profiles are readable by owner" on public.profiles;
create policy "Profiles are readable by owner"
on public.profiles
for select
to authenticated
using (id = auth.uid());

drop policy if exists "Profiles are writable by owner" on public.profiles;
create policy "Profiles are writable by owner"
on public.profiles
for all
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "Teams are visible to members" on public.teams;
create policy "Teams are visible to members"
on public.teams
for select
to authenticated
using (public.is_team_member(id));

drop policy if exists "Members can read their teams" on public.team_members;
create policy "Members can read their teams"
on public.team_members
for select
to authenticated
using (public.is_team_member(team_id));

drop policy if exists "Lists are visible to team members" on public.brocante_lists;
create policy "Lists are visible to team members"
on public.brocante_lists
for select
to authenticated
using (public.is_team_member(team_id));

drop policy if exists "Lists are writable by team members" on public.brocante_lists;
create policy "Lists are writable by team members"
on public.brocante_lists
for all
to authenticated
using (public.is_team_member(team_id))
with check (public.is_team_member(team_id));
