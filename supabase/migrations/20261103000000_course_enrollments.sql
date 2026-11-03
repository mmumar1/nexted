create table if not exists public.course_enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  unique (user_id, course_id)
);

create index if not exists idx_course_enrollments_course
  on public.course_enrollments(course_id, enrolled_at);

create index if not exists idx_course_enrollments_user
  on public.course_enrollments(user_id, enrolled_at);

alter table public.course_enrollments enable row level security;
revoke all on public.course_enrollments from anon, authenticated;
grant select, insert, delete on public.course_enrollments to authenticated;
grant all on public.course_enrollments to service_role;

drop policy if exists "Students can enroll themselves" on public.user_courses;
drop policy if exists "Admins and instructors can manage course enrollments" on public.user_courses;
drop policy if exists "Users can view their own enrollments" on public.user_courses;
revoke insert, update, delete on public.user_courses from anon, authenticated;
grant select on public.user_courses to authenticated;
grant all on public.user_courses to service_role;

drop policy if exists "Users can view their own course access grants" on public.user_courses;
create policy "Users can view their own course access grants"
on public.user_courses for select
using (auth.uid() = user_id);

drop policy if exists "Students can view their own course enrollments" on public.course_enrollments;
create policy "Students can view their own course enrollments"
on public.course_enrollments for select
using (auth.uid() = user_id);

drop policy if exists "Students can enroll in published self-enrollment courses" on public.course_enrollments;
create policy "Students can enroll in published self-enrollment courses"
on public.course_enrollments for insert
with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'student'
  )
  and exists (
    select 1 from public.courses c
    where c.id = course_id and c.is_published and c.enrollment_mode = 'self'
  )
);

drop policy if exists "Staff can view course enrollments they manage" on public.course_enrollments;
create policy "Staff can view course enrollments they manage"
on public.course_enrollments for select
using (
  exists (
    select 1
    from public.profiles p
    join public.courses c on c.id = course_id
    where p.id = auth.uid()
      and (
        p.role in ('admin', 'super_admin')
        or (p.role = 'instructor' and c.instructor_id = p.id)
      )
  )
);

drop policy if exists "Staff can manage course enrollments they own" on public.course_enrollments;
create policy "Staff can manage course enrollments they own"
on public.course_enrollments for all
using (
  exists (
    select 1
    from public.profiles p
    join public.courses c on c.id = course_id
    where p.id = auth.uid()
      and (
        p.role in ('admin', 'super_admin')
        or (p.role = 'instructor' and c.instructor_id = p.id)
      )
  )
)
with check (
  exists (
    select 1 from public.profiles enrolled_student
    where enrolled_student.id = user_id and enrolled_student.role = 'student'
  )
  and exists (
    select 1
    from public.profiles p
    join public.courses c on c.id = course_id
    where p.id = auth.uid()
      and (
        p.role in ('admin', 'super_admin')
        or (p.role = 'instructor' and c.instructor_id = p.id)
      )
  )
);

-- Preserve intentional manual enrollments and learners who already have course activity.
insert into public.course_enrollments (user_id, course_id)
select distinct historical.user_id, historical.course_id
from (
  select uc.user_id, uc.course_id
  from public.user_courses uc
  where uc.access_source = 'manual'
  union
  select mc.user_id, m.course_id
  from public.module_completions mc
  join public.modules m on m.id = mc.module_id
  union
  select qa.user_id, m.course_id
  from public.quiz_attempts qa
  join public.quizzes q on q.id = qa.quiz_id
  join public.modules m on m.id = q.module_id
) as historical
join public.profiles p on p.id = historical.user_id and p.role = 'student'
join public.courses c on c.id = historical.course_id
on conflict (user_id, course_id) do nothing;

drop policy if exists "Instructors can view course learner completions" on public.module_completions;
create policy "Instructors can view course learner completions"
on public.module_completions for select
using (
  exists (
    select 1
    from public.profiles p
    join public.modules m on m.id = module_id
    join public.courses c on c.id = m.course_id
    where p.id = auth.uid()
      and (
        p.role in ('admin', 'super_admin')
        or (p.role = 'instructor' and c.instructor_id = p.id)
      )
  )
);

drop policy if exists "Users can manage their own completion records" on public.module_completions;
create policy "Users can manage their own completion records"
on public.module_completions for all
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.modules m
    join public.course_enrollments ce on ce.course_id = m.course_id
    where m.id = module_id and ce.user_id = auth.uid()
  )
);

drop policy if exists "Instructors can view course learner quiz attempts" on public.quiz_attempts;
create policy "Instructors can view course learner quiz attempts"
on public.quiz_attempts for select
using (
  exists (
    select 1
    from public.profiles p
    join public.quizzes q on q.id = quiz_id
    join public.modules m on m.id = q.module_id
    join public.courses c on c.id = m.course_id
    where p.id = auth.uid()
      and (
        p.role in ('admin', 'super_admin')
        or (p.role = 'instructor' and c.instructor_id = p.id)
      )
  )
);

drop policy if exists "Users can manage their own quiz attempts" on public.quiz_attempts;
create policy "Users can manage their own quiz attempts"
on public.quiz_attempts for all
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.quizzes q
    join public.modules m on m.id = q.module_id
    join public.course_enrollments ce on ce.course_id = m.course_id
    where q.id = quiz_id and ce.user_id = auth.uid()
  )
);
