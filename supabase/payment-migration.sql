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

-- Free subscription coupons are redeemed by the server, never directly by clients.
create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  discount_percent integer not null check (discount_percent between 1 and 100),
  max_uses integer check (max_uses is null or max_uses > 0),
  used_count integer not null default 0 check (used_count >= 0),
  expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check (code = upper(btrim(code)))
);

create table if not exists public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  unique (coupon_id, user_id)
);

create index if not exists idx_coupon_redemptions_user
  on public.coupon_redemptions(user_id);

insert into public.coupons (code, discount_percent, max_uses, expires_at)
values ('LEARNPEDIA100', 100, null, null)
on conflict (code) do nothing;

alter table public.coupons enable row level security;
alter table public.coupon_redemptions enable row level security;
revoke all on public.coupons, public.coupon_redemptions from anon, authenticated;
grant all on public.coupons, public.coupon_redemptions to service_role;

create or replace function public.redeem_free_subscription_coupon(p_user_id uuid, p_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_coupon public.coupons%rowtype;
begin
  select * into selected_coupon
  from public.coupons
  where code = upper(btrim(p_code))
    and is_active
    and discount_percent = 100
    and (expires_at is null or expires_at > now())
    and (max_uses is null or used_count < max_uses)
  for update;

  if not found then
    raise exception 'Coupon is invalid, expired, inactive, or fully redeemed' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.coupon_redemptions
    where coupon_id = selected_coupon.id and user_id = p_user_id
  ) then
    raise exception 'This account has already redeemed this coupon' using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'Account profile not found' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.profiles where id = p_user_id and has_active_subscription) then
    raise exception 'A subscription is already active' using errcode = 'P0001';
  end if;

  insert into public.coupon_redemptions (coupon_id, user_id)
  values (selected_coupon.id, p_user_id);

  update public.coupons
  set used_count = used_count + 1
  where id = selected_coupon.id;

  update public.profiles
  set has_active_subscription = true,
      subscription_tier = 'one-time',
      subscription_paid_at = now()
  where id = p_user_id;

  insert into public.user_courses (user_id, course_id, access_source)
  select p_user_id, id, 'subscription'
  from public.courses
  where is_published = true
  on conflict (user_id, course_id) do nothing;
end;
$$;

revoke all on function public.redeem_free_subscription_coupon(uuid, text) from public, anon, authenticated;
grant execute on function public.redeem_free_subscription_coupon(uuid, text) to service_role;

-- Keep direct client profile updates from changing roles or subscription entitlements.
create or replace function public.prevent_profile_entitlement_updates()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() = old.id
    and coalesce(auth.role(), '') <> 'service_role'
    and (
      new.role is distinct from old.role
      or new.has_active_subscription is distinct from old.has_active_subscription
      or new.subscription_tier is distinct from old.subscription_tier
      or new.subscription_paid_at is distinct from old.subscription_paid_at
    ) then
    raise exception 'Role and subscription changes must be made by the server';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_entitlement_updates on public.profiles;
create trigger protect_profile_entitlement_updates
before update on public.profiles
for each row execute function public.prevent_profile_entitlement_updates();