-- Flort Chat schema (mail/auth bağımsız sürüm)

create extension if not exists pgcrypto;

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  password text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.virtual_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  age int not null check (age > 0),
  gender text not null,
  hobbies text,
  created_by text not null default 'admin',
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  virtual_profile_id uuid not null references public.virtual_profiles(id) on delete cascade,
  sender_role text not null check (sender_role in ('member', 'virtual')),
  content text not null,
  created_at timestamptz not null default now()
);

create or replace view public.admin_threads as
select
  m.member_id,
  vp.id as virtual_profile_id,
  mb.username as member_username,
  vp.name as virtual_name,
  max(m.created_at) as last_message_at
from public.messages m
join public.virtual_profiles vp on vp.id = m.virtual_profile_id
join public.members mb on mb.id = m.member_id
group by m.member_id, vp.id, mb.username, vp.name;

alter table public.members enable row level security;
alter table public.virtual_profiles enable row level security;
alter table public.messages enable row level security;

-- Auth tamamen kaldırıldığı için demo amaçlı anon erişim açık
create policy "members_all_anon"
  on public.members for all
  to anon, authenticated
  using (true)
  with check (true);

create policy "virtual_profiles_all_anon"
  on public.virtual_profiles for all
  to anon, authenticated
  using (true)
  with check (true);

create policy "messages_all_anon"
  on public.messages for all
  to anon, authenticated
  using (true)
  with check (true);
