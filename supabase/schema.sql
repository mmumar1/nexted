create extension if not exists pgcrypto;

create type public.app_role as enum ('student', 'instructor', 'admin', 'super_admin');
create type public.enrollment_mode as enum ('self', 'restricted');
create type public.project_status as enum ('pending', 'reviewed', 'approved', 'rejected');
create type public.payment_status as enum ('pending', 'success', 'failed', 'refunded');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null,
  state text,
  local_government_area text,
  phone_number text,
  whatsapp_number text,
  referral_code text,
  role public.app_role not null default 'student',
  has_active_subscription boolean not null default false,
  subscription_tier text not null default 'none',
  subscription_paid_at timestamptz,
  subscription_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  access_code text not null,
  thumbnail text,
  enrollment_mode public.enrollment_mode not null default 'self',
  instructor_id uuid references public.profiles(id) on delete set null,
  is_published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  access_source text not null default 'manual' check (access_source in ('manual', 'subscription')),
  unlocked_at timestamptz not null default now(),
  unique (user_id, course_id)
);

create table public.course_enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  unique (user_id, course_id)
);

create table public.partnership_interests (
  id uuid primary key default gen_random_uuid(),
  school_name text not null,
  school_address text not null,
  city_or_lga text not null,
  state text not null,
  school_type text not null check (school_type in ('Public', 'Private', 'Faith-based', 'Other')),
  website_or_social_page text,
  contact_name text not null,
  contact_position text not null,
  phone_number text not null,
  email_address text not null,
  preferred_communication text not null check (preferred_communication in ('Phone call', 'WhatsApp', 'Email')),
  student_count text not null check (student_count in ('Below 100', '100–300', '301–500', '501–1,000', 'Above 1,000')),
  classes_available text not null check (classes_available in ('Junior Secondary School', 'Senior Secondary School', 'Both', 'Other')),
  uses_digital_learning text not null check (uses_digital_learning in ('Yes', 'No', 'Exploring options')),
  digital_learning_details text,
  areas_of_interest text[] not null check (cardinality(areas_of_interest) > 0),
  other_interest text,
  challenges_and_needs text not null,
  partnership_arrangement text not null check (partnership_arrangement in ('Learning Access Partner', 'Digital Learning Partner', 'Strategic Education Partner', 'Need further info')),
  partnership_value text not null,
  orientation_interest text not null check (orientation_interest in ('Yes', 'No', 'Discuss first')),
  follow_up_period text,
  additional_comments text,
  acknowledged boolean not null check (acknowledged),
  submitted_at timestamptz not null default now()
);

create index idx_partnership_interests_submitted_at on public.partnership_interests(submitted_at desc);

create index idx_course_enrollments_course on public.course_enrollments(course_id, enrolled_at);
create index idx_course_enrollments_user on public.course_enrollments(user_id, enrolled_at);

create table public.modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  sort_order integer not null default 1,
  content text not null,
  video_url text,
  video_urls text[] not null default '{}'::text[],
  image_url text,
  parent_module_id uuid references public.modules(id) on delete set null,
  prerequisite_module_id uuid references public.modules(id) on delete set null,
  duration_minutes integer not null default 30,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.module_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  module_id uuid not null references public.modules(id) on delete cascade,
  completed_at timestamptz not null default now(),
  unique (user_id, module_id)
);

create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules(id) on delete cascade,
  title text not null,
  questions jsonb not null,
  pass_score integer not null default 70,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cbt_questions (
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

create table public.cbt_attempts (
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

create unique index idx_cbt_attempts_one_active_per_user
  on public.cbt_attempts(user_id) where status = 'in_progress';
create index idx_cbt_attempts_user_created
  on public.cbt_attempts(user_id, created_at desc);

create table public.cbt_attempt_answers (
  attempt_id uuid not null references public.cbt_attempts(id) on delete cascade,
  question_id uuid not null,
  selected_option integer not null check (selected_option between 1 and 4),
  answered_at timestamptz not null default now(),
  primary key (attempt_id, question_id)
);

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  score integer not null,
  total_questions integer not null,
  passed boolean not null default false,
  attempted_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  link text not null,
  description text not null,
  status public.project_status not null default 'pending',
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  author_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.events (
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

create index idx_events_status_starts_at on public.events(status, starts_at);
create index idx_events_author_updated on public.events(author_id, updated_at desc);

create table public.event_rsvps (
  event_id uuid not null references public.events(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('attending', 'not_attending')),
  updated_at timestamptz not null default now(),
  primary key (event_id, student_id)
);

create table public.event_notifications (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  revision integer not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique (event_id, student_id, revision)
);

create index idx_event_notifications_student_created
  on public.event_notifications(student_id, created_at desc);

create table public.course_conversations (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint course_conversations_course_student_key unique (course_id, student_id)
);

create index idx_course_conversations_student_updated
  on public.course_conversations(student_id, updated_at desc);

create table public.course_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.course_conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index idx_course_messages_conversation_created
  on public.course_messages(conversation_id, created_at desc);

create index idx_course_messages_unread
  on public.course_messages(conversation_id, sender_id)
  where read_at is null;

create function public.touch_course_conversation_after_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.course_conversations
  set updated_at = new.created_at
  where id = new.conversation_id;
  return new;
end;
$$;

create trigger course_messages_touch_conversation
after insert on public.course_messages
for each row execute function public.touch_course_conversation_after_message();

create function public.notify_students_about_event()
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

create trigger events_notify_students
after insert or update on public.events
for each row execute function public.notify_students_about_event();

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null check (provider in ('stripe', 'paystack', 'manual')),
  provider_ref text not null,
  amount numeric(10,2) not null,
  currency text not null default 'NGN',
  status public.payment_status not null default 'pending',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create type public.manual_payment_status as enum ('pending', 'approved', 'rejected');

create table public.manual_payment_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan text not null check (plan in ('monthly', 'yearly')),
  amount numeric(10,2) not null check (amount > 0),
  currency text not null default 'NGN' check (currency = 'NGN'),
  bank_name text not null check (bank_name in ('Sterling Bank', 'OPay')),
  bank_reference text not null,
  status public.manual_payment_status not null default 'pending',
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now()
);

create index idx_profiles_role on public.profiles(role);
create index idx_courses_instructor on public.courses(instructor_id);
create index idx_modules_course on public.modules(course_id);
create index idx_announcement_created_at on public.announcements(created_at desc);
create index idx_payments_user on public.payments(user_id);
create unique index idx_payments_provider_ref on public.payments(provider, provider_ref);
create index idx_cbt_questions_subject_year_status on public.cbt_questions(subject, exam_year, status);
create index idx_cbt_questions_exam_subject_year_topic on public.cbt_questions(exam_type, subject, exam_year, topic, status);
create index idx_cbt_questions_creator_updated on public.cbt_questions(created_by, updated_at desc);
create index idx_manual_payment_user on public.manual_payment_submissions(user_id);
create index idx_manual_payment_status_created on public.manual_payment_submissions(status, created_at);
create unique index idx_manual_payment_one_pending_per_user on public.manual_payment_submissions(user_id) where status = 'pending';
create unique index idx_manual_payment_bank_reference on public.manual_payment_submissions(bank_name, lower(btrim(bank_reference)));
