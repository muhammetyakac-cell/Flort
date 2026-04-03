-- Thread quick facts migration (idempotent)

create table if not exists public.thread_quick_facts (
  member_id uuid not null references public.members(id) on delete cascade,
  virtual_profile_id uuid not null references public.virtual_profiles(id) on delete cascade,
  notes text not null default '',
  updated_at timestamptz not null default now(),
  primary key (member_id, virtual_profile_id)
);

alter table public.thread_quick_facts enable row level security;

drop policy if exists "thread_quick_facts_all_anon" on public.thread_quick_facts;

create policy "thread_quick_facts_all_anon"
  on public.thread_quick_facts for all
  to anon, authenticated
  using (true)
  with check (true);
