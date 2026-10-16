-- Add the profile fields collected by the expanded registration form.
alter table public.profiles
  add column if not exists state text,
  add column if not exists local_government_area text,
  add column if not exists phone_number text,
  add column if not exists whatsapp_number text,
  add column if not exists referral_code text;

-- Store signup metadata in the profile created by the auth.users trigger.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    email,
    full_name,
    state,
    local_government_area,
    phone_number,
    whatsapp_number,
    referral_code,
    role
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    nullif(trim(new.raw_user_meta_data->>'state'), ''),
    nullif(trim(new.raw_user_meta_data->>'local_government_area'), ''),
    nullif(trim(new.raw_user_meta_data->>'phone_number'), ''),
    nullif(trim(new.raw_user_meta_data->>'whatsapp_number'), ''),
    nullif(trim(new.raw_user_meta_data->>'referral_code'), ''),
    'student'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
