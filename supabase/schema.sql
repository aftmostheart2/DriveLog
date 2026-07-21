-- CarKeep Supabase schema
-- Run this in Supabase SQL Editor after creating a project.

create extension if not exists pgcrypto;

create table if not exists public.vehicles (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  vehicle_id uuid,
  payload jsonb not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.services (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  vehicle_id uuid,
  payload jsonb not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reminders (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  vehicle_id uuid,
  payload jsonb not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.parts (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  vehicle_id uuid,
  payload jsonb not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  vehicle_id uuid,
  payload jsonb not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wishlist_items (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  vehicle_id uuid,
  payload jsonb not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vehicles_user_idx on public.vehicles(user_id);
create index if not exists services_user_idx on public.services(user_id);
create index if not exists reminders_user_idx on public.reminders(user_id);
create index if not exists parts_user_idx on public.parts(user_id);
create index if not exists projects_user_idx on public.projects(user_id);
create index if not exists wishlist_items_user_idx on public.wishlist_items(user_id);

create index if not exists services_vehicle_idx on public.services(vehicle_id);
create index if not exists reminders_vehicle_idx on public.reminders(vehicle_id);
create index if not exists parts_vehicle_idx on public.parts(vehicle_id);
create index if not exists projects_vehicle_idx on public.projects(vehicle_id);
create index if not exists wishlist_items_vehicle_idx on public.wishlist_items(vehicle_id);

alter table public.vehicles enable row level security;
alter table public.services enable row level security;
alter table public.reminders enable row level security;
alter table public.parts enable row level security;
alter table public.projects enable row level security;
alter table public.wishlist_items enable row level security;

do $$
declare table_name text;
begin
  foreach table_name in array array['vehicles','services','reminders','parts','projects','wishlist_items'] loop
    execute format('drop policy if exists "Users can read own %1$s" on public.%1$I', table_name);
    execute format('drop policy if exists "Users can insert own %1$s" on public.%1$I', table_name);
    execute format('drop policy if exists "Users can update own %1$s" on public.%1$I', table_name);
    execute format('drop policy if exists "Users can delete own %1$s" on public.%1$I', table_name);

    execute format('create policy "Users can read own %1$s" on public.%1$I for select using (auth.uid() = user_id)', table_name);
    execute format('create policy "Users can insert own %1$s" on public.%1$I for insert with check (auth.uid() = user_id)', table_name);
    execute format('create policy "Users can update own %1$s" on public.%1$I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', table_name);
    execute format('create policy "Users can delete own %1$s" on public.%1$I for delete using (auth.uid() = user_id)', table_name);
  end loop;
end $$;
