# Learnpedia Supabase setup

This folder contains the starting database schema and row-level security setup for the Learnpedia LMS.

## Files

- `schema.sql`: base tables and enumerations.
- `rls.sql`: triggers, security policies, and automatic profile creation.
- `seed.sql`: repeatable demo course, modules, quizzes, enrollments, and announcement data.
- `advanced-courses-seed.sql`: repeatable three-module course with nested submodules, videos, prerequisites, quizzes, and enrollments.
- `payment-migration.sql`: upgrade an existing database with subscription-owned enrollments.

## Recommended Supabase setup

1. Create a new Supabase project.
2. Open the SQL editor and run `schema.sql` first.
3. Run `rls.sql` second.
4. Register one user in Learnpedia, promote that user's profile to `super_admin`, then run `seed.sql`.
5. Add the following environment variables to your Vercel app/server:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `STRIPE_SECRET_KEY`
   - `PAYSTACK_SECRET_KEY`
6. Restart the server after setting environment variables.

## Password reset

The frontend routes are:

```text
/forgot-password
/reset-password
```

The flow uses Supabase Auth directly. No password-reset endpoint or password storage is required in Express.

In Supabase, open **Authentication -> URL Configuration** and add these redirect URLs:

```text
http://localhost:5000/reset-password
https://your-production-domain.com/reset-password
```

Set the site URL to your main application URL, for example:

```text
http://localhost:5000
```

In **Authentication -> Email Templates -> Reset Password**, make sure the template includes Supabase's recovery link variable:

```text
{{ .ConfirmationURL }}
```

Test the flow by opening `/forgot-password`, entering a registered email, clicking the email link, and choosing a new password on `/reset-password`. The reset link is short-lived and must not be copied into application storage or sent to the Express backend.

## Local commands

Run the application after configuring `.env.local`:

```powershell
npm run dev
```

The server now uses Supabase for courses, modules, quizzes, enrollments, module completions, quiz attempts, projects, profiles, and announcements. The old `npm run db:push` command is not part of the Supabase workflow.

## Course creation test

Run `advanced-courses-seed.sql` in the Supabase SQL Editor to create the final test course:

```text
Modern Web Development
```

It contains three modules:

- Web Foundations
- HTML Structure, nested under Web Foundations
- CSS Layout and Responsive Design, nested under HTML Structure

The course includes video URLs, prerequisites, quizzes, publication, and student enrollment. The final query in the script reports the module, quiz, and enrollment counts.

In the app, teachers and admins create courses from **Admin CMS -> Courses**. The API writes through the Supabase storage adapter, and new course, module, and quiz IDs come from Supabase. A newly created course starts unpublished; publish it from the course editor before checking the student dashboard.

## Paystack setup

For an existing database, run `payment-migration.sql`. For a new database, `schema.sql` already includes the subscription access column.

Set these server-side variables locally and in Vercel:

```env
PAYSTACK_SECRET_KEY=sk_test_your_paystack_test_secret
PAYSTACK_PLAN_AMOUNT=100000
PAYSTACK_CALLBACK_URL=http://localhost:5000/profile
```

`PAYSTACK_PLAN_AMOUNT` is in kobo, so `100000` means NGN 1,000. The browser never receives the secret key.

Configure the Paystack webhook URL as:

```text
https://your-api-domain.com/api/payments/paystack/webhook
```

Only a verified `charge.success` event updates `profiles.has_active_subscription`, records a successful payment, and grants published-course access. Failed and refunded events revoke subscription-owned access while preserving manual enrollments.

## Role model

- `student`: normal learner
- `instructor`: course owner / teacher
- `admin`: LMS manager
- `super_admin`: global platform owner

## MVP flow

- Student signs up
- A profile row is created automatically
- Student browses published courses
- Student enrolls using either self-serve or restricted access
- Instructor creates modules and announcements
- Student completes modules and quizzes
- Payment is captured via Stripe or Paystack when the subscription gate is triggered

## Deployment plan

Use Vercel for the frontend and serverless API layer. Use Supabase for auth, database, and role-based access control. Keep Stripe or Paystack webhooks in serverless functions or a dedicated backend that verifies payment status and updates the `profiles` and `payments` tables.

## Vercel deployment

This repository includes `vercel.json` and `api/index.ts`. Vercel serves the Vite build from `dist/public` and routes `/api/*` requests to the existing Express route handlers as a serverless function.

Add these variables in **Vercel -> Project Settings -> Environment Variables** for Preview and Production:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
SUPABASE_SERVICE_ROLE_KEY=your-server-only-service-role-key
PAYSTACK_SECRET_KEY=sk_live_or_sk_test_your-secret
PAYSTACK_PLAN_AMOUNT=100000
PAYSTACK_CALLBACK_URL=https://your-project.vercel.app/profile
```

Do not upload `.env.local` or add service keys with a `VITE_` prefix. Configure these Supabase redirect URLs for password reset:

```text
https://your-project.vercel.app/reset-password
https://your-production-domain.com/reset-password
```

Configure the Paystack webhook as:

```text
https://your-project.vercel.app/api/payments/paystack/webhook
```

The Vercel deployment uses the same-origin `/api/*` paths already used by the frontend. A successful build alone does not verify external Supabase credentials or Paystack webhook delivery; test login, course creation, password reset, checkout, and a signed webhook after deployment.
