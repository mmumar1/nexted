create table if not exists public.organization_partnership_interests (
  id uuid primary key default gen_random_uuid(),
  organization_name text not null,
  organization_type text not null check (organization_type in ('NGO / Nonprofit', 'Education provider', 'Company / Business', 'Government agency', 'Community organization', 'Other')),
  contact_name text not null,
  contact_role text not null,
  email_address text not null,
  phone_number text not null,
  website_or_social_page text,
  location text not null,
  areas_of_interest text[] not null check (cardinality(areas_of_interest) > 0),
  other_interest text,
  partnership_proposal text not null,
  partnership_arrangement text not null check (partnership_arrangement in ('Learning Access Partner', 'Digital Learning Partner', 'Strategic Education Partner', 'Need further info')),
  additional_comments text,
  acknowledged boolean not null check (acknowledged),
  submitted_at timestamptz not null default now()
);

create index if not exists idx_organization_partnership_interests_submitted_at
  on public.organization_partnership_interests(submitted_at desc);

alter table public.organization_partnership_interests enable row level security;
revoke all on public.organization_partnership_interests from anon, authenticated;
grant all on public.organization_partnership_interests to service_role;
