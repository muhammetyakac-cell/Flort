-- Engagement analytics migration (idempotent)

create extension if not exists pgcrypto;

create table if not exists public.engagement_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('member_message', 'admin_reply', 'profile_view')),
  member_id uuid references public.members(id) on delete cascade,
  virtual_profile_id uuid references public.virtual_profiles(id) on delete cascade,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.engagement_events enable row level security;

drop policy if exists "engagement_events_all_anon" on public.engagement_events;

create policy "engagement_events_all_anon"
  on public.engagement_events for all
  to anon, authenticated
  using (true)
  with check (true);
