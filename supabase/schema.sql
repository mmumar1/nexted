create extension if not exists pgcrypto;

create type public.app_role as enum ('student', 'instructor', 'admin', 'super_admin');
create type public.enrollment_mode as enum ('self', 'restricted');
create type public.project_status as enum ('pending', 'reviewed', 'approved', 'rejected');
create type public.payment_status as enum ('pending', 'success', 'failed', 'refunded');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null,
  role public.app_role not null default 'student',
  has_active_subscription boolean not null default false,
  subscription_tier text not null default 'none',
  subscription_paid_at timestamptz,
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

create table public.modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  sort_order integer not null default 1,
  content text not null,
  video_url text,
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

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null check (provider in ('stripe', 'paystack')),
  provider_ref text not null,
  amount numeric(10,2) not null,
  currency text not null default 'NGN',
  status public.payment_status not null default 'pending',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_profiles_role on public.profiles(role);
create index idx_courses_instructor on public.courses(instructor_id);
create index idx_modules_course on public.modules(course_id);
create index idx_announcement_created_at on public.announcements(created_at desc);
create index idx_payments_user on public.payments(user_id);
create unique index idx_payments_provider_ref on public.payments(provider, provider_ref);
