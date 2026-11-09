# School Referral and Registration Tracking

This document describes a future feature for onboarding partner schools and measuring student registration and learning activity attributed to each school. It is an implementation guide, not a description of functionality that already exists.

## Goals

- Give each confirmed partner school a shareable registration link and referral code.
- Attribute student accounts to a school when they register through that link or enter its code.
- Give authorized administrators useful, consistently defined school-level counts.
- Keep school-level course enrollment separate from content access and subscriptions.
- Minimize student data collection and protect minors' information.

## Current state

- The public partner application page lets schools and other organizations submit separate interest forms. A submission expresses interest; it does not establish an approved partner or assign a referral identity.
- The form and administrator inbox are described in [the partnership interest page](../../client/src/pages/partnership-interest.tsx) and [the partnership interest migration](../../supabase/migrations/20261107000000_school_partnership_interests.sql).
- Student sign-up is implemented in [the registration page](../../client/src/pages/register.tsx). It currently accepts a referral-code field, but that field is not yet a complete school-attribution and reporting system.
- Course participation is recorded separately from course access in `course_enrollments`; see [the enrollment migration](../../supabase/migrations/20261103000000_course_enrollments.sql) and [Supabase setup notes](../../supabase/README.md).

## Recommended approach

Use one Learnpedia domain and a hybrid of a readable school route and a referral code:

```text
https://learnpedia.com/schools/school-a
https://learnpedia.com/register?ref=SCHOOL-A
```

The school route is easier to share and can introduce the school or partnership. The code is a fallback for posters, messages, or registrations started without the route. Both resolve to the same server-managed school record. A subdomain per school is not needed.

Do not create a referral identity merely because someone submitted the interest form. A super admin should review the lead, confirm the arrangement, and explicitly activate the school. School records and their identifiers should be managed by trusted server-side APIs, not created or edited by anonymous visitors.

## Proposed user flows

### School onboarding

1. A school or representative submits the existing school interest form.
2. An authorized administrator reviews the submission and follows up.
3. Once the school is confirmed, a super admin activates a partner-school record, assigns a status, and generates a unique route slug and referral code.
4. The administrator shares the link and code with the school. Keep the interest submission linked to the resulting school record where appropriate, without treating the original submission as a student roster.
5. Provide an administrative way to pause or retire a school. Do not silently reassign its historical student attributions when a school name or contact changes.

### Student registration and attribution

1. Opening `/schools/:slug` resolves an active school and displays a short, school-branded introduction and a clear registration action. Unknown, inactive, or retired identifiers should not disclose private school details; show a neutral unavailable message and a general registration option.
2. The registration action carries the school referral identifier to the existing sign-up flow.
3. A student who arrives directly at registration can optionally enter the school's referral code. Validate it on the server and show a useful error for invalid or inactive codes.
4. Preserve a valid referral through email verification and the existing authentication flow. Do not trust a school ID or arbitrary metadata supplied by the browser as proof of attribution.
5. Save attribution once the account is successfully created, including the school, attribution method (link or code), and timestamp. Make retries idempotent.
6. Avoid collecting extra student or guardian contact information just to attribute a referral.

Before implementation, decide the attribution rule for a student who uses multiple school links or codes. Recommended default: retain the first valid school attribution and allow a super admin to correct it with an audit trail. Do not silently overwrite it on later visits.

## Reporting definitions

Use clear labels and count distinct student accounts, not raw events:

| Metric | Recommended definition |
|---|---|
| Referred students | Successfully created student accounts with this school as their saved attribution. If link visits are measured, report them separately as visits, not students. |
| Registered | Attributed student accounts created during the selected period, whether or not they have verified their email. |
| Verified | Attributed accounts whose email confirmation is complete, using the authoritative authentication state. |
| Enrolled | Distinct attributed students with at least one `course_enrollments` record. Do not infer enrollment from content access or a subscription. |
| Active learners | Distinct attributed students with at least one meaningful learning event in the selected period, such as a module completion or quiz attempt. Show the period and qualifying events in the UI. |

Use consistent date boundaries and filters for every metric. Avoid treating a page view, sign-in, or course unlock as evidence that a student actively learned. If reporting link visits is useful, decide retention and privacy rules before collecting them; do not make a persistent tracking cookie a prerequisite for registration.

## Data and API design guidance

Finalize names and migration details during implementation, but preserve these responsibilities:

- **Partner-school record:** stable ID, display name, unique normalized route slug, unique referral code, lifecycle status, creation/update timestamps, and a link to the originating interest submission when applicable.
- **Student attribution:** unique student/profile reference, school reference, attribution method, captured timestamp, and audit details for an authorized correction. Enforce at most one current school attribution per student unless a later product decision explicitly supports multiple schools.
- **Derived reporting:** calculate registration and learning counts from the authoritative profiles/authentication, enrollment, module-completion, and quiz-attempt records. Avoid maintaining counters that can drift from source records.
- **Lifecycle:** preserve historical attribution when a school is paused or retired. Prevent retired identifiers from being claimed by another school.
- **API security:** resolve codes and write attribution server-side. Restrict school management and student-level attribution access to authorized administrators. Instructors and school representatives should not receive student-level reports by default.
- **Database security:** add migrations with explicit grants and row-level security policies. Do not expose service-role credentials or private partner/student data to the browser.

Consider aggregated school reports first. Any later school-facing dashboard should have an explicit authorization model, show only that school's permitted data, and avoid exposing a minor's personal information unnecessarily.

## Privacy and safeguarding

- Collect only information necessary to provide the learning service and attribute participation.
- Explain in age-appropriate language what data is collected, why, who can see it, and how long it is retained.
- Determine the appropriate school and parent/guardian permissions before enrolling minors or processing their data. Confirm applicable legal requirements with qualified counsel before launch.
- Keep service communications separate from marketing. Do not use student contact information for school or Learnpedia marketing without an appropriate, separate consent process.
- Do not collect student phone numbers, WhatsApp numbers, addresses, or guardian contacts solely to measure referrals.
- Define retention, deletion, correction, and access processes for account attribution and reporting.
- Avoid public leaderboards or exports that reveal student identities by default.

As part of implementation planning, review the existing sign-up fields against data minimization goals. Keep any field required for an essential service only, explain why it is needed, and make nonessential fields optional or remove them after confirming their dependencies.

## Admin experience

Add a dedicated partner-school area for authorized administrators to:

- Review and activate eligible school interest submissions.
- Create, edit, pause, and retire partner-school records.
- See and copy the school's registration link and referral code.
- View aggregate counts for referred, registered, verified, enrolled, and active learners, with a selected reporting period.
- Inspect an audit trail for school status and attribution corrections.

Do not mark an unread school-interest submission as a confirmed partner automatically. Keep lead management and activated partner management conceptually distinct, even if they are linked in the admin interface.

## Implementation checklist

1. Confirm real partner onboarding, authorized roles, school contacts, and launch requirements.
2. Agree on attribution precedence, correction permissions, reporting periods, active-learner definition, and retention.
3. Review registration data minimization and the permissions/consent process for minors.
4. Design and test the school and attribution schema, constraints, indexes, migrations, grants, and row-level security.
5. Add server-side school management and referral resolution APIs with role checks and input validation.
6. Add `/schools/:slug`, referral propagation into sign-up, and idempotent account attribution through email verification.
7. Build the admin partner-school lifecycle and aggregate reporting views.
8. Add tests for route and code validation, inactive/unknown schools, attribution persistence, duplicate submissions, multiple referral attempts, verified status, enrollment/access separation, reporting periods, authorization, and privacy boundaries.
9. Test migration and rollback/recovery procedures against a staging Supabase project; never use real student data in fixtures.
10. Document the production migration and operational steps in [Supabase setup notes](../../supabase/README.md) before release.

## Acceptance criteria

- Each active school has a unique, stable route and referral code; collisions are rejected.
- A valid link and a valid manually entered code both attribute an eligible registration to the correct school.
- Attribution remains attached through email verification and is not overwritten by an untrusted client or a later school link.
- Unknown, inactive, and retired codes cannot create or change attribution.
- Retrying registration or attribution does not create duplicate student-school records.
- Reports distinguish registrations from verified accounts, course enrollments, and meaningful learning activity.
- Content access and subscription state do not count as course enrollment.
- Only authorized administrators can manage partner schools or access non-aggregate attribution data.
- Student and school data is collected and exposed only as required for the service and approved reporting.
