# Learnpedia Payments

This document describes the payment flow for Paystack checkout, manual bank-transfer review, and coupon codes.

## Current status

Implemented:

- Monthly (₦1,000) and yearly (₦5,000) plan selection; each unlocks all courses for its period
- Paystack checkout initialization
- Server-side Paystack secret handling
- Pending payment records
- Paystack webhook signature verification
- Subscription activation and expiration after verified `charge.success`
- Subscription-owned course access
- Subscription access removal after failed or refunded payments
- Upgrade CTA when a learner reaches a subscription-locked module
- Server-side redemption of 100% coupons, with per-account and usage-limit checks
- In-app bank-transfer submissions with pending, approved, and rejected states
- Admin CMS payment-review queue; only verified approvals activate subscriptions

Still to implement:

- Optional in-app receipt-file upload
- Admin UI for creating and managing coupons
- Partial-discount coupons and applying discounts to Paystack checkout

## Environment variables

Configure these variables in the Vercel project's **Production** environment. Redeploy after changing them. `VITE_` values are included in the client build; the service-role key and Paystack key are server-only.

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
SUPABASE_SERVICE_ROLE_KEY=your-server-only-service-role-key
PAYSTACK_SECRET_KEY=sk_test_your-paystack-test-secret
PAYSTACK_CALLBACK_URL=https://your-production-domain.example/profile
```

The server derives the selected plan's amount from `shared/payment-plans.ts`; do not set a client-controlled amount.

Never place `SUPABASE_SERVICE_ROLE_KEY` or `PAYSTACK_SECRET_KEY` in a `VITE_` variable.

On Vercel, `PAYSTACK_CALLBACK_URL` can be omitted: the server derives the HTTPS Profile URL from Vercel's production hostname (or deployment hostname for previews). Set it explicitly if your app uses a different public URL. On other production hosts, set it to your deployed HTTPS Profile URL. Use a real Paystack test secret for testing, then replace it with the live secret when enabling production payments. This redirect only returns the learner to the app; it does not prove payment. The webhook is the authority that activates access.

## Database migration

For a new project, run these files in Supabase SQL Editor:

```text
schema.sql
rls.sql
payment-migration.sql
subscription-expiry-migration.sql
manual-payment-approval-migration.sql
seed.sql
```

For an existing project that already has payments enabled, run:

```text
subscription-expiry-migration.sql
manual-payment-approval-migration.sql
```

If payments have not been enabled yet, run `payment-migration.sql` first, then `subscription-expiry-migration.sql`.
Run `manual-payment-approval-migration.sql` after the payment and subscription-expiry migrations to enable manual transfers and admin review.

The payment migration also creates `coupons` and `coupon_redemptions`, the atomic 100%-coupon redemption function, and a profile trigger that prevents browser clients from changing role or subscription fields. Apply it before enabling coupon redemption or relying on server-only subscription activation.

The migration seeds `LEARNPEDIA100` as a 100% coupon with no global use cap or expiry. Each account can redeem it once. To impose a global cap or expiration, update the coupon row in Supabase.

To create a separate limited code, for example with 100 redemptions and a 60-day expiry:

```sql
insert into public.coupons (code, discount_percent, max_uses, expires_at)
values ('FOUNDING100', 100, 100, now() + interval '60 days');
```

Set `max_uses` to `null` for no global usage cap. Each account can still redeem a given code only once. A 100% coupon is redeemed on the server, activates the subscription, and grants access without creating a Paystack charge.

The learner submits the selected plan, destination bank, and bank transaction reference from Profile. The server derives the price, creates a pending submission, and prevents duplicate pending submissions or reuse of the same bank reference. The learner can see the review status in Profile. Receipt-file upload is not yet available; staff verify the submitted reference against the bank record.

Only users with the `super_admin` role can see **Admin CMS -> Payments**, list submissions, or approve/reject them. Users with the `admin` role, instructors, and students cannot review manual payments. Approval is performed by a server-only database function in a single transaction: it checks the super-admin role, pending status, and plan amount; records a successful manual payment; activates the subscription through the plan expiry date; and grants access to published courses. Rejection records the reviewer and optional note without granting access. The browser cannot set a submission to approved or activate a subscription.

## Paystack checkout flow

1. A learner selects the monthly or yearly plan on the Payment section of Profile & settings, then chooses Paystack or bank transfer.
2. The server derives the Paystack amount from the selected plan, binds checkout to the signed-in Supabase user, and creates a pending `payments` row with the plan in metadata.
3. Paystack calls `/api/payments/paystack/webhook` after the transaction.
4. The webhook validates `x-paystack-signature`, reference, successful status, amount, and currency.
5. A valid `charge.success` changes the payment status and activates the profile subscription until the selected plan's expiry date.
6. The server grants access to published courses with `access_source = 'subscription'`.

Learners with a 100% coupon can redeem it from the Profile page instead. Coupon redemption does not redirect to Paystack or create a charge.

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
- Ignore duplicate and stale failure events when the payment is already successful/refunded.
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

The current coupon implementation supports **100% subscription coupons only**. The server validates and redeems them atomically through `redeem_free_subscription_coupon`; the browser never sends an amount or marks a payment successful. A successful redemption activates the one-time subscription and grants access to published courses without contacting Paystack. Partial/fixed discounts and applying coupon discounts to Paystack checkout are not implemented yet.

Create a code in Supabase using the example above. Choose `max_uses` to cap the first-user offer, or `null` for no global cap. The database also limits each account to one redemption of each code and enforces its optional expiry.

## Recommended API routes

```text
POST /api/payments/paystack/initialize
POST /api/payments/paystack/webhook
POST /api/payments/coupons/redeem
GET  /api/payments/manual-transfer
POST /api/payments/manual-transfer
GET  /api/admin/manual-payments
POST /api/admin/manual-payments/:id/review
```

All admin payment routes must verify the Supabase access token and load the caller's role from `public.profiles`. Never trust a browser-supplied `userId`, role, amount, discount, or approval status.

## UI acceptance criteria

- The learner can start Paystack checkout at the paid-module gate or profile page.
- The learner can redeem a 100% coupon for free access.
- Paystack redirects to the hosted checkout.
- A learner cannot unlock courses by editing browser storage.
- Successful payment updates the subscription badge after refresh.
- Failed, rejected, or refunded payments do not grant access.
- A bank-transfer submission remains pending until approved by an administrator.
- Admin-role users, instructors, and students cannot see the payment section or access the review API.
- Only a `super_admin` can list, approve, or reject manual-payment submissions.
- Rejection records its reviewer and note without changing course access.
- Replaying an approval cannot create a duplicate payment or enrollment.

## Test checklist

1. Test Paystack initialization with a test secret.
2. Confirm a pending `payments` row is created.
3. Send a valid signed `charge.success` webhook.
4. Confirm the payment becomes `success`.
5. Confirm the profile subscription becomes active.
6. Confirm published courses are inserted into `user_courses` with `access_source = 'subscription'`.
7. Redeem a valid 100% coupon and confirm no Paystack payment is created.
8. Confirm the same account cannot redeem that code twice.
9. Confirm inactive, expired, exhausted, and already-subscribed cases are rejected.
10. Replay the same webhook and confirm no duplicate payment or enrollment is created.
11. Submit a bank transfer and confirm it appears pending in Profile and Admin CMS.
12. Confirm an instructor cannot view or review manual-payment submissions.
13. Approve a pending transfer and confirm the payment, subscription expiry, and published-course access are recorded.
14. Reject a pending transfer and confirm no subscription or course access is granted.
