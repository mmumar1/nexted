create table if not exists public.cbt_questions (
  id uuid primary key default gen_random_uuid(),
  exam_type text check (exam_type in ('jamb', 'waec') or exam_type is null),
  subject text not null check (length(btrim(subject)) between 1 and 80),
  exam_year integer not null check (exam_year between 1950 and 2100),
  topic text check (topic is null or length(btrim(topic)) between 1 and 120),
  question text not null check (length(btrim(question)) between 1 and 10000),
  question_image_url text,
  options jsonb not null check (
    case
      when jsonb_typeof(options) = 'array' then jsonb_array_length(options) = 4
      else false
    end
  ),
  correct_answer integer not null check (correct_answer between 1 and 4),
  explanation text check (explanation is null or length(explanation) <= 10000),
  explanation_image_url text,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  published_by uuid references public.profiles(id) on delete set null,
  published_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.cbt_questions
  add column if not exists exam_type text,
  add column if not exists topic text;

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

create index if not exists idx_cbt_questions_subject_year_status
  on public.cbt_questions(subject, exam_year, status);

create index if not exists idx_cbt_questions_exam_subject_year_topic
  on public.cbt_questions(exam_type, subject, exam_year, topic, status);

create index if not exists idx_cbt_questions_creator_updated
  on public.cbt_questions(created_by, updated_at desc);

alter table public.cbt_questions enable row level security;

create table if not exists public.cbt_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  exam_type text check (exam_type in ('jamb', 'waec') or exam_type is null),
  mode text not null check (mode in ('self', 'mock')),
  selections jsonb not null check (jsonb_typeof(selections) = 'array'),
  duration_minutes integer not null check (duration_minutes between 1 and 120),
  question_snapshot jsonb not null check (
    case
      when jsonb_typeof(question_snapshot) = 'array' then jsonb_array_length(question_snapshot) > 0
      else false
    end
  ),
  status text not null default 'in_progress' check (status in ('in_progress', 'submitted', 'expired')),
  score integer check (score is null or score >= 0),
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  submitted_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.cbt_attempts add column if not exists exam_type text;

do $$
begin
  alter table public.cbt_attempts
    add constraint cbt_attempts_exam_type_check
    check (exam_type in ('jamb', 'waec') or exam_type is null);
exception
  when duplicate_object then null;
end $$;

create unique index if not exists idx_cbt_attempts_one_active_per_user
  on public.cbt_attempts(user_id) where status = 'in_progress';

create index if not exists idx_cbt_attempts_user_created
  on public.cbt_attempts(user_id, created_at desc);

create table if not exists public.cbt_attempt_answers (
  attempt_id uuid not null references public.cbt_attempts(id) on delete cascade,
  question_id uuid not null,
  selected_option integer not null check (selected_option between 1 and 4),
  answered_at timestamptz not null default now(),
  primary key (attempt_id, question_id)
);

alter table public.cbt_attempts enable row level security;
alter table public.cbt_attempt_answers enable row level security;
