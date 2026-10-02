# Learnpedia Payments

This document describes the payment flow for Paystack checkout, manual bank-transfer review, and coupon codes.

## Current status

Implemented:

- Paystack checkout initialization
- Server-side Paystack secret handling
- Pending payment records
- Paystack webhook signature verification
- Subscription activation after `charge.success`
- Subscription-owned course access
- Subscription access removal after failed or refunded payments

Still to implement:

- Manual bank-transfer submission and admin approval UI
- Coupon-code validation and discount calculation
- Payment checkout UI that combines Paystack, bank transfer, and coupon entry

## Environment variables

Keep these variables on the server. Only variables with the `VITE_` prefix are exposed to the browser.

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
SUPABASE_SERVICE_ROLE_KEY=your-server-only-service-role-key
PAYSTACK_SECRET_KEY=sk_test_your-paystack-test-secret
PAYSTACK_PLAN_AMOUNT=100000
PAYSTACK_CALLBACK_URL=http://localhost:5000/profile
```

`PAYSTACK_PLAN_AMOUNT` is expressed in kobo. `100000` means NGN 1,000.

Never place `SUPABASE_SERVICE_ROLE_KEY` or `PAYSTACK_SECRET_KEY` in a `VITE_` variable.

## Database migration

For a new project, run these files in Supabase SQL Editor:

```text
schema.sql
rls.sql
payment-migration.sql
seed.sql
```

For an existing project, run only:

```text
payment-migration.sql
```

The following schema extends the current payment model for manual transfers and coupons:

```sql
create type public.manual_payment_status as enum (
  'pending',
  'approved',
  'rejected'
);

create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  discount_type text not null check (discount_type in ('fixed', 'percentage')),
  discount_value numeric(10,2) not null check (discount_value > 0),
  max_uses integer,
  used_count integer not null default 0,
  expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.manual_payment_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(10,2) not null,
  currency text not null default 'NGN',
  bank_reference text not null,
  proof_url text,
  coupon_code text,
  status public.manual_payment_status not null default 'pending',
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now()
);

create index idx_manual_payment_user
  on public.manual_payment_submissions(user_id);

create index idx_manual_payment_status
  on public.manual_payment_submissions(status);
```

Example coupon:

```sql
insert into public.coupons (
  code,
  discount_type,
  discount_value,
  max_uses,
  expires_at
) values (
  'WELCOME20',
  'percentage',
  20,
  100,
  now() + interval '30 days'
);
```

## Paystack checkout flow

1. The learner opens the payment UI.
2. The learner enters an optional coupon code.
3. The browser sends the coupon code to the server.
4. The server validates the coupon and calculates the final amount.
5. The server creates a pending row in `payments`.
6. The server initializes Paystack using `PAYSTACK_SECRET_KEY`.
7. The browser redirects to the Paystack authorization URL.
8. Paystack calls the webhook.
9. The webhook validates `x-paystack-signature`.
10. The server verifies the transaction amount and reference.
11. A valid `charge.success` event changes the payment to `success`.
12. The server sets `profiles.has_active_subscription = true`.
13. The server grants published courses with `access_source = 'subscription'`.

The browser redirect is not proof of payment. Access must only be granted after server-side verification.

## Paystack webhook

Configure this URL in the Paystack dashboard:

```text
https://your-backend-domain.com/api/payments/paystack/webhook
```

For local testing, expose the local server through a tunnel such as ngrok:

```powershell
ngrok http 5000
```

Then use:

```text
https://your-ngrok-domain.ngrok-free.app/api/payments/paystack/webhook
```

The webhook must:

- Read the raw request body.
- Calculate HMAC-SHA512 with `PAYSTACK_SECRET_KEY`.
- Compare it with `x-paystack-signature` using a timing-safe comparison.
- Find the existing payment by provider and reference.
- Reject amount or currency mismatches.
- Be idempotent when Paystack retries an event.
- Activate access only for verified successful payments.

## Manual bank-transfer flow

Add a payment method selector to the profile/payment UI:

```text
Paystack
Bank transfer
```

For bank transfer, display configured account details from server configuration or a public settings table:

```text
Account name: Learnpedia Academy
Bank: Example Bank
Account number: 0000000000
```

The learner submits:

- Amount paid
- Bank transaction reference
- Optional proof-of-payment image or PDF
- Optional coupon code

The server creates a `manual_payment_submissions` row with `status = 'pending'`. The browser must not set the status to approved and must not activate the subscription.

The admin UI should provide:

- Pending transfer list
- Reference and proof preview
- Approve action
- Reject action with a note

When an admin approves a transfer in a server-side route:

1. Revalidate the amount and coupon.
2. Update the submission to `approved`.
3. Insert a successful `payments` row with `provider = 'manual'` or extend the provider constraint to allow it.
4. Set `profiles.has_active_subscription = true`.
5. Grant published courses with `access_source = 'subscription'`.
6. Record `reviewed_by` and `reviewed_at`.

On rejection, do not change the profile subscription or course access.

## Coupon flow

Coupon validation must happen on the server. The browser may display a preview, but the server is authoritative.

Recommended validation rules:

- Normalize codes to uppercase.
- Require `is_active = true`.
- Reject expired coupons.
- Reject coupons whose `max_uses` has been reached.
- Apply percentage discounts with a maximum discount equal to the order amount.
- Never allow a negative final amount.
- Increment `used_count` only inside the successful payment approval transaction.
- Store the coupon code and discount amount in `payments.metadata` or the manual submission record.

Example calculation:

```text
base amount:       NGN 1,000
WELCOME20:             20%
discount:          NGN   200
final amount:      NGN   800
Paystack amount:   80,000 kobo
```

## Recommended API routes

```text
POST /api/payments/paystack/initialize
POST /api/payments/paystack/webhook
POST /api/payments/coupons/validate
POST /api/payments/manual
GET  /api/admin/payments/manual
POST /api/admin/payments/manual/:id/approve
POST /api/admin/payments/manual/:id/reject
```

All admin payment routes must verify the Supabase access token and load the caller's role from `public.profiles`. Never trust a browser-supplied `userId`, role, amount, discount, or approval status.

## UI acceptance criteria

- The learner can choose Paystack or bank transfer.
- The learner can enter and validate a coupon before paying.
- The final amount is visible before checkout.
- Paystack redirects to the hosted checkout.
- Bank transfers show `Pending review` until approved.
- A learner cannot unlock courses by editing browser storage.
- Admins can approve or reject manual transfers.
- Successful payment updates the subscription badge after refresh.
- Failed, rejected, or refunded payments do not grant access.

## Test checklist

1. Test Paystack initialization with a test secret.
2. Confirm a pending `payments` row is created.
3. Send a valid signed `charge.success` webhook.
4. Confirm the payment becomes `success`.
5. Confirm the profile subscription becomes active.
6. Confirm published courses are inserted into `user_courses` with `access_source = 'subscription'`.
7. Submit a manual transfer and confirm it remains pending.
8. Approve it as an admin and confirm the same access changes.
9. Reject another transfer and confirm no access is granted.
10. Test valid, expired, inactive, exhausted, percentage, and fixed-value coupons.
11. Replay the same webhook and confirm no duplicate payment or enrollment is created.
