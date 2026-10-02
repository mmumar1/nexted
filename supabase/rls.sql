-- Auto-create a profile when a new Supabase auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'student'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'on_auth_user_created'
      and tgrelid = 'auth.users'::regclass
  ) then
    create trigger on_auth_user_created
      after insert on auth.users
      for each row execute procedure public.handle_new_user();
  end if;
end;
$$;

-- Keep profile timestamp fresh.
create or replace function public.update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
before update on public.profiles
for each row execute procedure public.update_updated_at();

create trigger courses_updated_at
before update on public.courses
for each row execute procedure public.update_updated_at();

create trigger modules_updated_at
before update on public.modules
for each row execute procedure public.update_updated_at();

create trigger projects_updated_at
before update on public.projects
for each row execute procedure public.update_updated_at();

create trigger payments_updated_at
before update on public.payments
for each row execute procedure public.update_updated_at();

-- Read the current role without recursively evaluating profiles RLS policies.
create or replace function public.current_user_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- Enable Row Level Security.
alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.user_courses enable row level security;
alter table public.modules enable row level security;
alter table public.module_completions enable row level security;
alter table public.quizzes enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.projects enable row level security;
alter table public.announcements enable row level security;
alter table public.payments enable row level security;

-- Profiles
create policy "Users can view their own profile"
on public.profiles for select
using (auth.uid() = id);

create policy "Users can update their own profile"
on public.profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "Admins can manage all profiles"
on public.profiles for all
using (
  public.current_user_role() in ('admin', 'super_admin')
)
with check (
  public.current_user_role() in ('admin', 'super_admin')
);

-- Courses
create policy "Published courses are visible to all authenticated users"
on public.courses for select
using (is_published = true and auth.role() = 'authenticated');

create policy "Admins and instructors manage courses"
on public.courses for all
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('instructor', 'admin', 'super_admin')
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('instructor', 'admin', 'super_admin')
  )
);

-- User course enrollments
create policy "Users can view their own enrollments"
on public.user_courses for select
using (auth.uid() = user_id);

create policy "Students can enroll themselves"
on public.user_courses for insert
with check (auth.uid() = user_id);

create policy "Admins and instructors can manage course enrollments"
on public.user_courses for all
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('instructor', 'admin', 'super_admin')
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('instructor', 'admin', 'super_admin')
  )
);

-- Modules and progress
create policy "Users can view modules in enrolled courses"
on public.modules for select
using (
  auth.role() = 'authenticated' and exists (
    select 1
    from public.user_courses uc
    where uc.user_id = auth.uid()
      and uc.course_id = public.modules.course_id
  )
);

create policy "Instructors and admins can manage modules"
on public.modules for all
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('instructor', 'admin', 'super_admin')
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('instructor', 'admin', 'super_admin')
  )
);

create policy "Users can manage their own completion records"
on public.module_completions for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Quizzes and attempts
create policy "Authenticated users can see quizzes in enrolled courses"
on public.quizzes for select
using (
  auth.role() = 'authenticated' and exists (
    select 1
    from public.modules m
    join public.user_courses uc on uc.course_id = m.course_id
    where m.id = public.quizzes.module_id and uc.user_id = auth.uid()
  )
);

create policy "Instructors and admins manage quizzes"
on public.quizzes for all
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('instructor', 'admin', 'super_admin')
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('instructor', 'admin', 'super_admin')
  )
);

create policy "Users can manage their own quiz attempts"
on public.quiz_attempts for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Projects
create policy "Users can view their own project submissions"
on public.projects for select
using (auth.uid() = user_id);

create policy "Students can submit their own projects"
on public.projects for insert
with check (auth.uid() = user_id);

create policy "Admins and instructors can review projects"
on public.projects for update
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('instructor', 'admin', 'super_admin')
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('instructor', 'admin', 'super_admin')
  )
);

-- Announcements
create policy "Authenticated users can read announcements"
on public.announcements for select
using (auth.role() = 'authenticated');

create policy "Admins and instructors can create announcements"
on public.announcements for insert
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('instructor', 'admin', 'super_admin')
  )
);

-- Payments
create policy "Users can view their own payments"
on public.payments for select
using (auth.uid() = user_id);

create policy "Users can insert their own payment records"
on public.payments for insert
with check (auth.uid() = user_id);

create policy "Admins can view all payments"
on public.payments for select
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'super_admin')
  )
);