-- Run this only when schema.sql was executed before payment access tracking was added.
alter table public.user_courses
  add column if not exists access_source text not null default 'manual';

alter table public.user_courses
  drop constraint if exists user_courses_access_source_check;

alter table public.user_courses
  add constraint user_courses_access_source_check
  check (access_source in ('manual', 'subscription'));

create unique index if not exists idx_payments_provider_ref
  on public.payments(provider, provider_ref);