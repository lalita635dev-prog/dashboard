-- Dashboard v3.3.0: Agenda y recordatorios por usuario.
-- Ejecutar una sola vez en Supabase > SQL Editor.
create table if not exists public.dashboard_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  description text not null default '',
  reminder_date date not null,
  reminder_time time,
  color text not null default '#6366f1' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  relation_type text check (relation_type in ('project', 'job', 'task') or relation_type is null),
  relation_id text,
  relation_label text,
  completed boolean not null default false,
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists dashboard_reminders_user_date_idx
  on public.dashboard_reminders(user_id, reminder_date, reminder_time);
alter table public.dashboard_reminders enable row level security;
drop policy if exists "Users manage their own reminders" on public.dashboard_reminders;
create policy "Users manage their own reminders" on public.dashboard_reminders
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
grant select, insert, update, delete on public.dashboard_reminders to authenticated;
