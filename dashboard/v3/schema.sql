-- Dashboard v3.0 - ejecutar en Supabase > SQL Editor.
-- Los registros se guardan como JSONB para preservar la estructura de los objetos actuales.
-- La propiedad se controla con auth.uid() y RLS; no desactivar estas políticas.

create table if not exists public.dashboard_jobs (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.dashboard_projects (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.dashboard_tools (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists dashboard_jobs_user_id_idx on public.dashboard_jobs(user_id);
create index if not exists dashboard_projects_user_id_idx on public.dashboard_projects(user_id);
create index if not exists dashboard_tools_user_id_idx on public.dashboard_tools(user_id);

alter table public.dashboard_jobs enable row level security;
alter table public.dashboard_projects enable row level security;
alter table public.dashboard_tools enable row level security;

drop policy if exists "Users manage their own jobs" on public.dashboard_jobs;
create policy "Users manage their own jobs" on public.dashboard_jobs
  for all to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Users manage their own projects" on public.dashboard_projects;
create policy "Users manage their own projects" on public.dashboard_projects
  for all to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Users manage their own tools" on public.dashboard_tools;
create policy "Users manage their own tools" on public.dashboard_tools
  for all to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.dashboard_jobs to authenticated;
grant select, insert, update, delete on public.dashboard_projects to authenticated;
grant select, insert, update, delete on public.dashboard_tools to authenticated;
