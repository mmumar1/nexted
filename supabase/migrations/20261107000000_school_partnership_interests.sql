create table if not exists public.partnership_interests (
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

create index if not exists idx_partnership_interests_submitted_at
  on public.partnership_interests(submitted_at desc);

alter table public.partnership_interests enable row level security;
revoke all on public.partnership_interests from anon, authenticated;
grant all on public.partnership_interests to service_role;
