create table if not exists public.profiles (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  updated_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id text not null,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 500),
  due_date date not null,
  due_time time not null,
  priority text not null check (priority in ('low', 'medium', 'high')),
  completed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.entries (
  id text not null,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  entry_date date not null,
  content text not null,
  mood smallint not null check (mood between 1 and 5),
  energy smallint not null check (energy between 1 and 5),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  unique (user_id, entry_date)
);

create table if not exists public.migration_status (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  legacy_migrated_at timestamptz not null default now()
);

create index if not exists tasks_user_date_idx on public.tasks (user_id, due_date, due_time);
create index if not exists entries_user_date_idx on public.entries (user_id, entry_date desc);

alter table public.profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.entries enable row level security;
alter table public.migration_status enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_delete_own" on public.profiles;
drop policy if exists "tasks_select_own" on public.tasks;
drop policy if exists "tasks_insert_own" on public.tasks;
drop policy if exists "tasks_update_own" on public.tasks;
drop policy if exists "tasks_delete_own" on public.tasks;
drop policy if exists "entries_select_own" on public.entries;
drop policy if exists "entries_insert_own" on public.entries;
drop policy if exists "entries_update_own" on public.entries;
drop policy if exists "entries_delete_own" on public.entries;
drop policy if exists "migration_status_select_own" on public.migration_status;
drop policy if exists "migration_status_insert_own" on public.migration_status;
drop policy if exists "migration_status_update_own" on public.migration_status;

create policy "profiles_select_own" on public.profiles for select using (auth.uid() = user_id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = user_id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "profiles_delete_own" on public.profiles for delete using (auth.uid() = user_id);

create policy "tasks_select_own" on public.tasks for select using (auth.uid() = user_id);
create policy "tasks_insert_own" on public.tasks for insert with check (auth.uid() = user_id);
create policy "tasks_update_own" on public.tasks for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "tasks_delete_own" on public.tasks for delete using (auth.uid() = user_id);

create policy "entries_select_own" on public.entries for select using (auth.uid() = user_id);
create policy "entries_insert_own" on public.entries for insert with check (auth.uid() = user_id);
create policy "entries_update_own" on public.entries for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "entries_delete_own" on public.entries for delete using (auth.uid() = user_id);

create policy "migration_status_select_own" on public.migration_status for select using (auth.uid() = user_id);
create policy "migration_status_insert_own" on public.migration_status for insert with check (auth.uid() = user_id);
create policy "migration_status_update_own" on public.migration_status for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles, public.tasks, public.entries to authenticated;
grant select, insert, update on public.migration_status to authenticated;
