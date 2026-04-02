-- Flort Chat schema (mail/auth bağımsız sürüm)

create extension if not exists pgcrypto;

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  password text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.member_profiles (
  member_id uuid primary key references public.members(id) on delete cascade,
  age int,
  hobbies text,
  city text,
  photo_url text,
  updated_at timestamptz not null default now()
);

create table if not exists public.virtual_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  age int not null check (age > 0),
  gender text not null,
  hobbies text,
  photo_url text,
  created_by text not null default 'admin',
  created_at timestamptz not null default now()
);


-- Eski tabloda eksik kolonları tamamla
alter table if exists public.virtual_profiles
  add column if not exists photo_url text;

alter table if exists public.member_profiles
  add column if not exists photo_url text,
  add column if not exists city text,
  add column if not exists hobbies text,
  add column if not exists age int;

-- Eski şemadan gelen created_by uuid kolonunu text'e çevir (çakışmasız migration)
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'virtual_profiles'
      and column_name = 'created_by'
      and data_type = 'uuid'
  ) then
    begin
      alter table public.virtual_profiles drop constraint if exists virtual_profiles_created_by_fkey;
    exception when undefined_object then
      null;
    end;

    alter table public.virtual_profiles
      alter column created_by type text using coalesce(created_by::text, 'admin');
  end if;

  alter table public.virtual_profiles
    alter column created_by set default 'admin',
    alter column created_by set not null;
end $$;

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  virtual_profile_id uuid not null references public.virtual_profiles(id) on delete cascade,
  sender_role text not null check (sender_role in ('member', 'virtual')),
  content text not null,
  created_at timestamptz not null default now()
);

-- Eski şemadan gelen messages.member_id foreign key'ini members tablosuna taşı
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema='public' and table_name='messages'
  ) then
    alter table public.messages drop constraint if exists messages_member_id_fkey;

    delete from public.messages m
    where not exists (
      select 1 from public.members mb where mb.id = m.member_id
    );

    alter table public.messages
      add constraint messages_member_id_fkey
      foreign key (member_id) references public.members(id) on delete cascade;
  end if;
end $$;

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
alter table public.member_profiles enable row level security;
alter table public.virtual_profiles enable row level security;
alter table public.messages enable row level security;

-- Politikaları idempotent yapmak için önce varsa sil
drop policy if exists "members_all_anon" on public.members;
drop policy if exists "member_profiles_all_anon" on public.member_profiles;
drop policy if exists "virtual_profiles_all_anon" on public.virtual_profiles;
drop policy if exists "messages_all_anon" on public.messages;

create policy "members_all_anon"
  on public.members for all
  to anon, authenticated
  using (true)
  with check (true);

create policy "member_profiles_all_anon"
  on public.member_profiles for all
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

-- Storage bucket + policy (profil fotoğrafları)
insert into storage.buckets (id, name, public)
values ('profile-images', 'profile-images', true)
on conflict (id) do nothing;

drop policy if exists "profile_images_public_read" on storage.objects;
drop policy if exists "profile_images_anon_insert" on storage.objects;
drop policy if exists "profile_images_anon_update" on storage.objects;

create policy "profile_images_public_read"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'profile-images');

create policy "profile_images_anon_insert"
on storage.objects for insert
to anon, authenticated
with check (bucket_id = 'profile-images');

create policy "profile_images_anon_update"
on storage.objects for update
to anon, authenticated
using (bucket_id = 'profile-images')
with check (bucket_id = 'profile-images');
