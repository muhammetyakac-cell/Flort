-- Flort Chat schema (email/auth bağımlılığı olmadan)

create extension if not exists pgcrypto;

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  password text not null,
  role text not null check (role in ('admin', 'member')),
  created_at timestamptz not null default now()
);

create table if not exists public.virtual_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  age int not null check (age > 0),
  gender text not null,
  hobbies text,
  created_by uuid references public.app_users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.app_users(id),
  virtual_profile_id uuid not null references public.virtual_profiles(id) on delete cascade,
  sender_role text not null check (sender_role in ('member', 'virtual')),
  content text not null,
  created_at timestamptz not null default now()
);

create or replace view public.admin_threads as
select
  m.member_id,
  vp.id as virtual_profile_id,
  au.username as member_username,
  vp.name as virtual_name,
  max(m.created_at) as last_message_at
from public.messages m
join public.virtual_profiles vp on vp.id = m.virtual_profile_id
join public.app_users au on au.id = m.member_id
group by m.member_id, vp.id, au.username, vp.name;

-- demo amaçlı: RLS kapalı (uygulama seviyesinde kontrol)
alter table public.app_users disable row level security;
alter table public.virtual_profiles disable row level security;
alter table public.messages disable row level security;
