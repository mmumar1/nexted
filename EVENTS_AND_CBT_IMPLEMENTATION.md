# Events and CBT Implementation Specification

This document captures the planned Events and JAMB-style CBT features. The current application adds student-menu navigation and placeholder pages, plus separate Events and CBT question-bank entry points in Admin CMS. Event management, notifications, calendar integration, question authoring, and test delivery are not implemented yet.

## Navigation delivered now

- Add **Events** and **CBT practice** to the authenticated navigation menu.
- `/events` and `/cbt` open clear placeholder pages rather than 404s.
- Keep these actions separate from Profile & settings and from the existing course quiz experience.
- Admin CMS provides separate **Events** and **CBT question bank** sections on desktop navigation and the mobile section selector.
- The Admin CMS sections explain the planned scope but do not expose nonfunctional create/edit controls.
- Preserve the existing course quiz builder and its workflow; CBT question authoring must be implemented separately.

## Events

### Student experience

- Provide an Events page showing upcoming events, with useful event details such as title, description, start/end date and time, timezone, organizer/teacher, and relevant course or audience.
- Clearly distinguish upcoming, in-progress, and past events; do not show unpublished or unauthorized events.
- Let students add an event to their calendar. Support a downloadable calendar file (for example, ICS) and/or a calendar subscription/integration after deciding which calendar providers to support.
- Provide notifications when a teacher creates or changes an event. Define delivery channels (in-app, email, push, or a combination), opt-out behavior, and how reminders are scheduled.
- Notify only the students targeted by the event, and avoid duplicate notifications when event data is retried or edited.

### Teacher experience

- Give authorized teachers an event creation flow separate from quizzes.
- Capture title, description, start/end time, timezone, audience/course, and optional location or online meeting link.
- Support editing, cancellation/deletion, and publication state.
- Validate date ranges and require an explicit timezone so displayed times and calendar entries remain consistent.
- On publish/update/cancel, notify the correct audience and keep calendar data current.

### Access, privacy, and reliability

- Enforce teacher permissions server-side: teachers may manage events only for courses/audiences they are authorized to teach; administrators may manage all events.
- Enforce student visibility server-side, not only by hiding UI.
- Store event timestamps consistently (UTC plus an explicit timezone where needed).
- Make notification and calendar generation idempotent; surface delivery failures and provide retry/observability rather than silently losing notifications.

## CBT practice

CBT means a separate computer-based test system for JAMB-standard mock preparation, not an extension of the existing course quiz builder/player.

### Student experience

- Let students choose the available subject(s) and exam year before starting a practice test.
- Generate a paper from the selected subject/year question bank.
- Use 40 questions for each selected non-English subject and 60 questions for English. A multi-subject test includes the required count for each selected subject.
- Provide a timed test with a visible countdown and a clear submission/expiry state.
- Let students jump directly between questions, move forward/back, and see which questions are answered or unanswered.
- Preserve answers while navigating. Confirm before a manual submit when unanswered questions remain; submit automatically when time expires.
- Show results and review only according to the configured result/review policy.
- Keep a student's in-progress attempt recoverable on refresh or temporary connection loss where safe and practical.

### Teacher/admin authoring

- Provide a teacher-facing CBT authoring area separate from course quizzes.
- Let authorized staff create and manage CBT questions, assign subject and year, set the correct answer, and provide optional explanation/media.
- Support drafts, review/publish status, editing, and archival so unreviewed questions are not served in live practice.
- Validate that each published question has the required choices and one valid correct answer.
- Provide a way to maintain and audit the available subjects, years, and question counts.

### Test generation, timing, and scoring

- Build attempts only from published questions for the selected subject/year; avoid repeating a question inside one attempt.
- Confirm the exact exam duration policy before implementation. It was not specified yet whether timing is per subject or per combined paper, or what duration to use.
- Define scoring, negative marking (if any), randomization, review availability, and retake behavior before launch; do not assume these policies from question counts alone.
- Persist attempt start/end time, selected options, final score, and completion state securely.
- Treat server-side attempt state and deadlines as authoritative; do not trust a client countdown or submitted score.

### Security and integrity

- Enforce student ownership of attempts and teacher authorization for question-bank changes.
- Keep correct answers and scoring data out of APIs that serve an active attempt until reveal is allowed.
- Validate submitted question IDs and options against the specific attempt.
- Rate-limit attempt creation/submission and record audit history for teacher edits and test completion.
- Make submission idempotent and handle network retries without duplicate results.

## Decisions to confirm before full implementation

- Which calendar destinations are required: downloadable ICS, Google Calendar, Outlook, device calendar, or calendar subscription?
- Which notification channels are in scope, and what reminder schedule should apply?
- Are Events visible to every student or only course/enrollment-specific audiences? Can students RSVP?
- What is the CBT duration for English, each other subject, and multi-subject combined tests?
- Is the 40-question count required independently for every selected non-English subject?
- What are the scoring, negative-marking, question-randomization, answer-review, and retake policies?
- How will teachers supply questions initially (manual entry, CSV import, or both), and who reviews/publishes them?
- Should CBT content be organized by year only, or also by exam session/version?

## Suggested implementation sequence

1. Confirm the outstanding product decisions above and the required roles.
2. Design the database schema, row-level authorization, and server APIs for events, notifications, CBT question banks, and attempts.
3. Implement the teacher event authoring and event publication lifecycle.
4. Implement student event listing, calendar export/sync, and notification delivery.
5. Implement the teacher CBT question-bank editor and publishing workflow.
6. Implement subject/year selection, timed test attempts, navigation, submission, scoring, and review.
7. Add focused authorization, validation, time-expiry, retry/idempotency, and end-to-end tests before enabling the features.
