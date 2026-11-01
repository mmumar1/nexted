alter table public.cbt_questions
  add column if not exists exam_type text,
  add column if not exists topic text;

alter table public.cbt_attempts
  add column if not exists exam_type text;

do $$
begin
  alter table public.cbt_questions
    add constraint cbt_questions_exam_type_check
    check (exam_type in ('jamb', 'waec') or exam_type is null);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.cbt_questions
    add constraint cbt_questions_topic_check
    check (topic is null or length(btrim(topic)) between 1 and 120);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.cbt_attempts
    add constraint cbt_attempts_exam_type_check
    check (exam_type in ('jamb', 'waec') or exam_type is null);
exception
  when duplicate_object then null;
end $$;

create index if not exists idx_cbt_questions_exam_subject_year_topic
  on public.cbt_questions(exam_type, subject, exam_year, topic, status);
