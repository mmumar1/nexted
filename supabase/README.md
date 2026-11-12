# Learnpedia Supabase setup

This folder contains the starting database schema and row-level security setup for the Learnpedia LMS.

## Files

- `schema.sql`: base tables and enumerations.
- `rls.sql`: triggers, security policies, and automatic profile creation.
- `seed.sql`: repeatable demo course, modules, quizzes, enrollments, and announcement data.
- `advanced-courses-seed.sql`: repeatable three-module course with nested submodules, videos, prerequisites, quizzes, and enrollments.
- `payment-migration.sql`: upgrade an existing database with subscription-owned enrollments.
- `registration-profile-migration.sql`: upgrade an existing database for the expanded signup fields.
- `module-video-urls-migration.sql`: upgrade an existing database to support multiple module video links.
- `cbt-question-bank-migration.sql`: add the CBT question bank, student attempts, and answer storage.
- `cbt-exam-topics-migration.sql`: add JAMB/UTME or WAEC/NECO categories and topics to the CBT bank.
- `events-notifications-migration.sql`: add staff-managed events, student RSVPs, and in-app event notifications.
- `migrations/20261103000000_course_enrollments.sql`: separate learner enrollment from content access and preserve historical course activity.
- `migrations/20261107000000_school_partnership_interests.sql`: store school partnership interest submissions with access limited to the server service role.
- `migrations/20261110000000_organization_partnership_interests.sql`: store non-school organization applications separately, with access limited to the server service role.
- `migrations/20261112000000_bulk_course_import.sql`: create course drafts and nested modules/lessons atomically from a validated Word import.
- `migrations/20261113000000_append_course_import.sql`: append validated Word-import modules atomically to an existing course.
- `migrations/20261114000000_instructor_activity_course_updates.sql`: record staff sign-ins and refresh course update timestamps when modules change.

## Recommended Supabase setup

1. Create a new Supabase project.
2. Open the SQL editor and run `schema.sql` first.
3. Run `rls.sql` second.
4. Run `migrations/20261103000000_course_enrollments.sql` to configure the enrollment/progress policies.
5. Run `migrations/20261107000000_school_partnership_interests.sql` to enable the school partnership form and admin inbox.
6. Run `migrations/20261110000000_organization_partnership_interests.sql` to enable applications from other organizations.
7. Run `migrations/20261112000000_bulk_course_import.sql` to enable atomic bulk course draft creation.
8. Run `migrations/20261113000000_append_course_import.sql` to enable appending modules to existing courses.
9. Run `migrations/20261114000000_instructor_activity_course_updates.sql` to enable instructor login activity and course content update timestamps.
10. Register one user in Learnpedia, promote that user's profile to `super_admin`, then run `seed.sql`.
11. Add the following environment variables to your Vercel app/server:
   - `SUPABASE_URL` and `SUPABASE_ANON_KEY` (or the legacy `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`)
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `STRIPE_SECRET_KEY`
   - `PAYSTACK_SECRET_KEY`
12. Restart the server after setting environment variables.

The public partner application page lets applicants choose either a school form or a separate other-organization form. Both save through server APIs into separate tables. Anonymous and regular authenticated clients have no direct table access; super admins can review both types in **Admin CMS → Partner applications**.

## Instructor activity and course updates

The **Admin CMS → Users** page shows each instructor's last recorded sign-in. Tracking starts after this migration and the updated application are deployed; earlier sign-in history is not available. Course cards show the last update time, including course module and lesson additions, edits, and deletions.

## Bulk course import

In **Admin CMS → Courses**, staff can download `client/public/templates/learnpedia-course-import-template.docx`, replace its bracketed examples, then upload the `.docx` document (up to 5 MB) for validation and preview before importing it. Use Heading 1 for the course title, a `Description: ...` paragraph, Heading 2 headings in the form `Module 1: Title`, and Heading 3 headings in the form `Lesson 1: Title`. Lesson paragraphs and lists become Markdown in their original order. Put `Image: https://...` and `Video: https://...` on separate lines under a lesson; image links stay at that exact position in the explanation.

The importer supports external HTTP(S) image links and YouTube video links only. Embedded Word images, audio, quiz questions, flashcards, H5P, and non-YouTube video links are not supported. A new import creates an unpublished draft assigned to the signed-in staff member. To add more content later, choose an existing course the staff member can manage; new modules are appended without replacing existing content or changing the course title and description. This also works for published courses. Number modules from 1 within each document; Learnpedia assigns them the next module numbers in the selected course. Quizzes can still be added using the existing quiz workflow.

## Enrollment and access are separate

`course_enrollments` records a student's decision to participate in a course. Students enroll from a published course card when self-enrollment is enabled; instructors can enroll students in courses assigned to them, and super admins can view progress across all courses. Enrolling does not grant paid access.

`user_courses` remains the content-access grant table used for subscription-owned access. Subscription access can unlock course content without automatically enrolling the student. The migration backfills prior manual enrollments and students who already have module completions or quiz attempts, so existing learning history is not lost.

Instructors can see individual progress only for courses assigned to them. Course progress includes module completion, latest quiz scores/pass status, and last recorded learning activity; it does not infer time spent or general engagement.

For an existing database, ensure `payment-migration.sql` has added `user_courses.access_source`, then apply `migrations/20261103000000_course_enrollments.sql` before deploying the enrollment and learner-progress UI. It creates the enrollment table, transfers historical participation, and updates row-level security so students cannot grant themselves content access by inserting into `user_courses`.

For an existing Supabase project, run `registration-profile-migration.sql` in the SQL Editor before accepting new signups. The migration adds nullable profile columns and updates the auth-user trigger so new account metadata is copied into `public.profiles`. Existing profiles remain valid and their new fields will be `NULL`.

For an existing project, run `cbt-question-bank-migration.sql` in the SQL Editor before using **Admin CMS -> CBT question bank** or student CBT practice. It creates the separate question, attempt, and answer tables and enables row-level security; authenticated server APIs use the service-role client after checking the student's or staff member's Supabase identity and role.

For an existing CBT installation, run `cbt-exam-topics-migration.sql` before deploying the exam-card and topic-selection experience. Existing questions remain uncategorized and are not offered to students until a teacher selects them in the question bank and bulk-assigns an exam category and topic. Reclassified published questions return to draft so teachers can review them before publishing under the new category.

For an existing project, run `events-notifications-migration.sql` in the SQL Editor before using Events. It adds event scheduling, RSVP records, and per-student in-app notifications. Notifications are generated idempotently for each published event revision, including cancellations.

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

For an existing project, run `module-video-urls-migration.sql` in the Supabase SQL editor before deploying the multiple-video module editor. It creates `modules.video_urls` and copies each existing `video_url` into the new array column. New projects receive the column from `schema.sql`.

## Paystack setup

For an existing database, run `payment-migration.sql`, `subscription-expiry-migration.sql`, and `manual-payment-approval-migration.sql` in that order. For a new database, run `schema.sql`, `rls.sql`, `payment-migration.sql`, `subscription-expiry-migration.sql`, and `manual-payment-approval-migration.sql`.

Set these server-side variables locally and in Vercel:

```env
PAYSTACK_SECRET_KEY=sk_test_your_paystack_test_secret
PAYSTACK_CALLBACK_URL=http://localhost:5000/profile
```

Plan prices are configured in `shared/payment-plans.ts` and enforced by the server. The browser never receives the Paystack secret key.

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

If API requests fail with `FUNCTION_INVOCATION_FAILED` despite a successful build, see [Vercel API Runtime Failures](../VERCEL_API_RUNTIME_TROUBLESHOOTING.md).

Add these variables in **Vercel -> Project Settings -> Environment Variables** for Preview and Production:

```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-public-key
SUPABASE_SERVICE_ROLE_KEY=your-server-only-service-role-key
PAYSTACK_SECRET_KEY=sk_live_or_sk_test_your-secret
```

The server derives plan prices from `shared/payment-plans.ts`.

`PAYSTACK_CALLBACK_URL` is optional on Vercel: the server builds the HTTPS Profile URL from Vercel's production hostname, or the deployment hostname for previews. Set it explicitly if you use a different public URL. Other production hosts must provide this variable as an HTTPS URL.

The Supabase URL and anon key are public client configuration. The Vite build explicitly maps the unprefixed names to the client's `import.meta.env` values; alternatively, retain the `VITE_` names. Mark these two values as **Config** in Vercel, not Sensitive. Keep service keys without a `VITE_` prefix and private. Do not upload `.env.local`. Configure these Supabase redirect URLs for password reset:

```text
https://your-project.vercel.app/reset-password
https://your-production-domain.com/reset-password
```

Configure the Paystack webhook as:

```text
https://your-project.vercel.app/api/payments/paystack/webhook
```

The Vercel deployment uses the same-origin `/api/*` paths already used by the frontend. A successful build alone does not verify external Supabase credentials or Paystack webhook delivery; test login, course creation, password reset, checkout, and a signed webhook after deployment.
