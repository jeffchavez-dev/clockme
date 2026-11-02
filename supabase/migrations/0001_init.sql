-- clockme schema. Every row belongs to one user; RLS keeps users to their own
-- rows, and realtime streams changes so a timer started on one device shows up
-- running on every other device signed in to the same account.

create table public.projects (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  color text not null,
  created_at timestamptz not null default now()
);

create table public.tags (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table public.entries (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  description text not null default '',
  start_at timestamptz not null,
  end_at timestamptz, -- null while the timer is running
  project_id uuid references public.projects on delete set null,
  tag_ids uuid[] not null default '{}',
  billable boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint end_after_start check (end_at is null or end_at >= start_at)
);

create index entries_user_start on public.entries (user_id, start_at desc);
-- One running timer per user, enforced by the database rather than the client.
create unique index entries_one_running on public.entries (user_id) where end_at is null;

create table public.settings (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  member text not null default 'Me',
  workspace text not null default 'My Workspace'
);

alter table public.projects enable row level security;
alter table public.tags enable row level security;
alter table public.entries enable row level security;
alter table public.settings enable row level security;

create policy "own projects" on public.projects for all
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own tags" on public.tags for all
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own entries" on public.entries for all
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own settings" on public.settings for all
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

alter publication supabase_realtime add table public.entries, public.projects, public.tags, public.settings;
