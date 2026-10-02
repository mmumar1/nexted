-- Learnpedia demo content seed.
-- Run schema.sql and rls.sql before this file.
-- This script is rerunnable and never creates Auth users or passwords.

do $$
declare
  owner_id uuid;
  v_course_id uuid;
  module_one_id uuid;
  module_two_id uuid;
  module_three_id uuid;
begin
  select id into owner_id
  from public.profiles
  where role in ('super_admin', 'admin', 'instructor')
  order by created_at
  limit 1;

  if owner_id is null then
    raise exception 'Create and promote at least one staff profile before running seed.sql';
  end if;

  select id into v_course_id
  from public.courses
  where access_code = 'BIO-101-DEMO'
  limit 1;

  if v_course_id is null then
    insert into public.courses (
      title, description, access_code, thumbnail, enrollment_mode,
      instructor_id, is_published, published_at
    ) values (
      'Biology Foundations',
      'A practical introduction to cells, genetics, and human biology.',
      'BIO-101-DEMO',
      'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=1200&q=80',
      'self',
      owner_id,
      true,
      now()
    ) returning id into v_course_id;
  end if;

  insert into public.modules (
    course_id, title, sort_order, content, duration_minutes
  )
  select v_course_id, 'Introduction to Cells', 1,
    '<h3>Introduction to Cells</h3><p>Explore the structure and function of the cell.</p>', 25
  where not exists (
    select 1 from public.modules m where m.course_id = v_course_id and m.title = 'Introduction to Cells'
  );

  select id into module_one_id from public.modules m where m.course_id = v_course_id and m.title = 'Introduction to Cells' limit 1;

  insert into public.modules (
    course_id, title, sort_order, content, prerequisite_module_id, duration_minutes
  )
  select v_course_id, 'Genetics Basics', 2,
    '<h3>Genetics Basics</h3><p>Learn how traits are inherited and expressed.</p>', module_one_id, 30
  where not exists (
    select 1 from public.modules m where m.course_id = v_course_id and m.title = 'Genetics Basics'
  );

  select id into module_two_id from public.modules m where m.course_id = v_course_id and m.title = 'Genetics Basics' limit 1;

  insert into public.modules (
    course_id, title, sort_order, content, parent_module_id, prerequisite_module_id, duration_minutes
  )
  select v_course_id, 'DNA and Replication', 3,
    '<h3>DNA and Replication</h3><p>Understand DNA structure and replication.</p>', module_two_id, module_two_id, 35
  where not exists (
    select 1 from public.modules m where m.course_id = v_course_id and m.title = 'DNA and Replication'
  );

  select id into module_three_id from public.modules m where m.course_id = v_course_id and m.title = 'DNA and Replication' limit 1;

  insert into public.quizzes (module_id, title, questions, pass_score)
  select module_one_id, 'Cells Checkpoint', jsonb_build_array(
    jsonb_build_object('id', 'cells-1', 'question', 'What is the basic unit of life?', 'options', jsonb_build_array('Cell', 'Organ', 'Tissue'), 'correctAnswer', 0)
  ), 70
  where not exists (select 1 from public.quizzes where module_id = module_one_id);

  insert into public.quizzes (module_id, title, questions, pass_score)
  select module_two_id, 'Genetics Checkpoint', jsonb_build_array(
    jsonb_build_object('id', 'genetics-1', 'question', 'What carries genetic information?', 'options', jsonb_build_array('DNA', 'Water', 'Glucose'), 'correctAnswer', 0)
  ), 70
  where not exists (select 1 from public.quizzes where module_id = module_two_id);

  insert into public.user_courses (user_id, course_id)
  select p.id, v_course_id
  from public.profiles p
  where p.role = 'student'
    and not exists (
      select 1 from public.user_courses uc
      where uc.user_id = p.id and uc.course_id = v_course_id
    );

  insert into public.announcements (title, message, author_id)
  select 'Welcome to Biology Foundations', 'Your first course modules are now available in Learnpedia.', owner_id
  where not exists (
    select 1 from public.announcements where title = 'Welcome to Biology Foundations'
  );
end;
$$;

select
  c.title,
  count(distinct m.id) as modules,
  count(distinct q.id) as quizzes,
  count(distinct uc.user_id) as enrolled_students
from public.courses c
left join public.modules m on m.course_id = c.id
left join public.quizzes q on q.module_id = m.id
left join public.user_courses uc on uc.course_id = c.id
where c.access_code = 'BIO-101-DEMO'
group by c.id, c.title;
