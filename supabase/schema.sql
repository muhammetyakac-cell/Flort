-- Flort Chat schema (Supabase PostgreSQL)

create table if not exists public.virtual_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  age int not null check (age > 0),
  gender text not null,
  hobbies text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references auth.users(id),
  virtual_profile_id uuid not null references public.virtual_profiles(id) on delete cascade,
  sender_role text not null check (sender_role in ('member', 'virtual')),
  content text not null,
  created_at timestamptz not null default now()
);

create or replace view public.admin_threads as
select
  m.member_id,
  vp.id as virtual_profile_id,
  coalesce(au.raw_user_meta_data->>'username', au.email) as member_username,
  vp.name as virtual_name,
  max(m.created_at) as last_message_at
from public.messages m
join public.virtual_profiles vp on vp.id = m.virtual_profile_id
join auth.users au on au.id = m.member_id
group by m.member_id, vp.id, member_username, vp.name;

alter table public.virtual_profiles enable row level security;
alter table public.messages enable row level security;

-- Virtual profiles: everybody authenticated can read, only configured admin email can write
-- IMPORTANT: replace admin@example.com with your real admin email
create policy "virtual_profiles_select_authenticated"
  on public.virtual_profiles for select
  to authenticated
  using (true);

create policy "virtual_profiles_admin_write"
  on public.virtual_profiles for all
  to authenticated
  using (auth.email() = 'admin@example.com')
  with check (auth.email() = 'admin@example.com');

-- Messages: users only their own thread messages; admins can see/respond all
create policy "messages_member_select_own"
  on public.messages for select
  to authenticated
  using (
    (auth.email() = 'admin@example.com')
    or (member_id = auth.uid())
  );

create policy "messages_insert_member_or_admin"
  on public.messages for insert
  to authenticated
  with check (
    ((auth.email() = 'admin@example.com') and sender_role = 'virtual')
    or ((member_id = auth.uid()) and sender_role = 'member')
  );
