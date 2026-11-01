create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) between 1 and 160),
  description text not null check (length(btrim(description)) between 1 and 10000),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  timezone text not null,
  location text,
  meeting_url text,
  status text not null default 'draft' check (status in ('draft', 'published', 'cancelled')),
  revision integer not null default 0 check (revision >= 0),
  author_id uuid not null references public.profiles(id) on delete restrict,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (meeting_url is null or meeting_url ~ '^https://')
);

create index if not exists idx_events_status_starts_at on public.events(status, starts_at);
create index if not exists idx_events_author_updated on public.events(author_id, updated_at desc);

create table if not exists public.event_rsvps (
  event_id uuid not null references public.events(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('attending', 'not_attending')),
  updated_at timestamptz not null default now(),
  primary key (event_id, student_id)
);

create table if not exists public.event_notifications (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  revision integer not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique (event_id, student_id, revision)
);

create index if not exists idx_event_notifications_student_created
  on public.event_notifications(student_id, created_at desc);

create or replace function public.notify_students_about_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'published' then
      insert into public.event_notifications (event_id, student_id, revision)
      select new.id, profiles.id, new.revision
      from public.profiles
      where profiles.role = 'student'
      on conflict (event_id, student_id, revision) do nothing;
    end if;
  elsif (new.status = 'published'
         and (old.status <> 'published' or new.revision > old.revision))
    or (new.status = 'cancelled' and old.status = 'published') then
    insert into public.event_notifications (event_id, student_id, revision)
    select new.id, profiles.id, new.revision
    from public.profiles
    where profiles.role = 'student'
    on conflict (event_id, student_id, revision) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists events_notify_students on public.events;
create trigger events_notify_students
after insert or update on public.events
for each row execute function public.notify_students_about_event();

alter table public.events enable row level security;
alter table public.event_rsvps enable row level security;
alter table public.event_notifications enable row level security;
