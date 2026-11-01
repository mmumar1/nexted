alter table public.profiles
  add column if not exists subscription_expires_at timestamptz;

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

  if exists (
    select 1 from public.profiles
    where id = p_user_id
      and has_active_subscription
      and (subscription_expires_at is null or subscription_expires_at > now())
  ) then
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
      subscription_paid_at = now(),
      subscription_expires_at = null
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
      or new.subscription_expires_at is distinct from old.subscription_expires_at
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
