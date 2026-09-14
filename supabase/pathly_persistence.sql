-- Pathly persistence for onboarding and route progress.
-- Run once in the Supabase SQL Editor connected to project qfkzalijwqbpxskgttsg.
-- The app keeps localStorage as a safe fallback until this migration is applied.

create table if not exists public.pathly_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  onboarding jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.pathly_route_progress (
  user_id uuid primary key references auth.users (id) on delete cascade,
  route_signature text not null,
  progress jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.pathly_profiles enable row level security;
alter table public.pathly_route_progress enable row level security;

drop policy if exists "pathly_profiles_select_own" on public.pathly_profiles;
drop policy if exists "pathly_profiles_insert_own" on public.pathly_profiles;
drop policy if exists "pathly_profiles_update_own" on public.pathly_profiles;
drop policy if exists "pathly_route_progress_select_own" on public.pathly_route_progress;
drop policy if exists "pathly_route_progress_insert_own" on public.pathly_route_progress;
drop policy if exists "pathly_route_progress_update_own" on public.pathly_route_progress;

create policy "pathly_profiles_select_own"
  on public.pathly_profiles for select to authenticated
  using (auth.uid() = user_id);
create policy "pathly_profiles_insert_own"
  on public.pathly_profiles for insert to authenticated
  with check (auth.uid() = user_id);
create policy "pathly_profiles_update_own"
  on public.pathly_profiles for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "pathly_route_progress_select_own"
  on public.pathly_route_progress for select to authenticated
  using (auth.uid() = user_id);
create policy "pathly_route_progress_insert_own"
  on public.pathly_route_progress for insert to authenticated
  with check (auth.uid() = user_id);
create policy "pathly_route_progress_update_own"
  on public.pathly_route_progress for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update on public.pathly_profiles to authenticated;
grant select, insert, update on public.pathly_route_progress to authenticated;
