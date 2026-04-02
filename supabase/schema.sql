-- Flort Chat schema (email bağımlılığı tamamen kaldırıldı)

create extension if not exists pgcrypto;

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  password text not null,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.virtual_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  age int not null check (age > 0),
  gender text not null,
  hobbies text,
  created_by text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  member_username text not null,
  virtual_profile_id uuid not null references public.virtual_profiles(id) on delete cascade,
  sender_role text not null check (sender_role in ('member', 'virtual')),
  content text not null,
  created_at timestamptz not null default now()
);

create or replace view public.admin_threads as
select
  m.member_username,
  vp.id as virtual_profile_id,
  vp.name as virtual_name,
  max(m.created_at) as last_message_at
from public.messages m
join public.virtual_profiles vp on vp.id = m.virtual_profile_id
group by m.member_username, vp.id, vp.name;

alter table public.app_users enable row level security;
alter table public.virtual_profiles enable row level security;
alter table public.messages enable row level security;

-- Bu sürümde auth email/JWT bağımlılığı yok: frontend session localStorage üstünden yönetiliyor.
-- Demo akışı için authenticated + anon'a full erişim verildi.

drop policy if exists "app_users_all" on public.app_users;
create policy "app_users_all"
  on public.app_users for all
  using (true)
  with check (true);

drop policy if exists "virtual_profiles_all" on public.virtual_profiles;
create policy "virtual_profiles_all"
  on public.virtual_profiles for all
  using (true)
  with check (true);

drop policy if exists "messages_all" on public.messages;
create policy "messages_all"
  on public.messages for all
  using (true)
  with check (true);
