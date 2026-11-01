do $$
begin
  create type public.manual_payment_status as enum ('pending', 'approved', 'rejected');
exception
  when duplicate_object then null;
end $$;

alter table public.payments
  drop constraint if exists payments_provider_check;

alter table public.payments
  add constraint payments_provider_check
  check (provider in ('stripe', 'paystack', 'manual'));

create table if not exists public.manual_payment_submissions (
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

create index if not exists idx_manual_payment_user
  on public.manual_payment_submissions(user_id);

create index if not exists idx_manual_payment_status_created
  on public.manual_payment_submissions(status, created_at);

create unique index if not exists idx_manual_payment_one_pending_per_user
  on public.manual_payment_submissions(user_id)
  where status = 'pending';

create unique index if not exists idx_manual_payment_bank_reference
  on public.manual_payment_submissions(bank_name, bank_reference);

alter table public.manual_payment_submissions enable row level security;

drop policy if exists "Users can view their own manual payment submissions"
  on public.manual_payment_submissions;
create policy "Users can view their own manual payment submissions"
  on public.manual_payment_submissions for select
  using (auth.uid() = user_id);

drop policy if exists "Admins can view all manual payment submissions"
  on public.manual_payment_submissions;
create policy "Admins can view all manual payment submissions"
  on public.manual_payment_submissions for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'super_admin', 'superadmin')
    )
  );

create or replace function public.review_manual_payment(
  p_submission_id uuid,
  p_reviewer_id uuid,
  p_decision text,
  p_review_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  submission public.manual_payment_submissions%rowtype;
  reviewer_role text;
  paid_at timestamptz := clock_timestamp();
  expected_amount numeric(10,2);
  plan_duration interval;
  v_subscription_expires_at timestamptz;
begin
  if p_decision is null or p_decision not in ('approved', 'rejected') then
    raise exception 'Decision must be approved or rejected' using errcode = '22023';
  end if;

  select role into reviewer_role
  from public.profiles
  where id = p_reviewer_id;

  if reviewer_role is null or reviewer_role not in ('admin', 'super_admin', 'superadmin') then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  select * into submission
  from public.manual_payment_submissions
  where id = p_submission_id
  for update;

  if not found then
    raise exception 'Manual payment submission not found' using errcode = 'P0002';
  end if;

  if submission.status <> 'pending' then
    raise exception 'This payment submission has already been reviewed' using errcode = 'P0001';
  end if;

  if p_decision = 'rejected' then
    update public.manual_payment_submissions
    set status = 'rejected',
        reviewed_by = p_reviewer_id,
        reviewed_at = paid_at,
        review_note = nullif(trim(p_review_note), '')
    where id = p_submission_id;

    return jsonb_build_object('id', p_submission_id, 'status', 'rejected');
  end if;

  expected_amount := case submission.plan
    when 'monthly' then 1000
    when 'yearly' then 5000
    else null
  end;
  if expected_amount is null or submission.amount <> expected_amount then
    raise exception 'Submitted amount does not match the selected plan' using errcode = '22023';
  end if;

  perform 1
  from public.profiles
  where id = submission.user_id
    and has_active_subscription
    and (subscription_expires_at is null or subscription_expires_at > paid_at)
  for update;
  if found then
    raise exception 'The learner already has an active subscription' using errcode = 'P0001';
  end if;

  plan_duration := case submission.plan
    when 'monthly' then interval '1 month'
    when 'yearly' then interval '1 year'
  end;
  v_subscription_expires_at := paid_at + plan_duration;

  update public.manual_payment_submissions
  set status = 'approved',
      reviewed_by = p_reviewer_id,
      reviewed_at = paid_at,
      review_note = nullif(trim(p_review_note), '')
  where id = p_submission_id;

  insert into public.payments (
    user_id, provider, provider_ref, amount, currency, status, metadata
  ) values (
    submission.user_id,
    'manual',
    'manual_' || submission.id::text,
    submission.amount,
    submission.currency,
    'success',
    jsonb_build_object(
      'plan', submission.plan,
      'bank_name', submission.bank_name,
      'bank_reference', submission.bank_reference,
      'manual_submission_id', submission.id
    )
  );

  update public.profiles
  set has_active_subscription = true,
      subscription_tier = submission.plan,
      subscription_paid_at = paid_at,
      subscription_expires_at = v_subscription_expires_at
  where id = submission.user_id;

  insert into public.user_courses (user_id, course_id, access_source)
  select submission.user_id, c.id, 'subscription'
  from public.courses c
  where c.is_published
  on conflict (user_id, course_id) do nothing;

  return jsonb_build_object('id', p_submission_id, 'status', 'approved');
end;
$$;

revoke all on function public.review_manual_payment(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.review_manual_payment(uuid, uuid, text, text)
  to service_role;
