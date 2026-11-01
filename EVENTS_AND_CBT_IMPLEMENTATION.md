# Events and CBT Implementation Specification

This document records the Events and JAMB-style CBT features and their implementation status. Staff event management, student event listings and RSVPs, in-app event notifications, and calendar exports are implemented. The CBT question-authoring slice and student CBT test flow are also implemented.

## Current implementation status

- **CBT authoring (complete):** Staff can create questions manually or import a CSV (up to 200 questions per import), filter and edit their question bank, publish drafts, and archive or restore questions. Instructors manage their own questions; admins can manage all questions. Editing a published question returns it to draft for review.
- **Student CBT flow (implemented):** Students can select published questions by subject and year, create self-tests or standard mocks, resume one active attempt, navigate and answer with automatic server persistence, submit or time out, and review scores, answers, explanations, and pace. Question snapshots, timing, scoring, ownership, and answer-key reveal are enforced server-side. Attempt creation is limited to 10 per minute per student.
- **Events (implemented):** Staff can create drafts, publish, edit, cancel, and delete draft events. Students can see published and cancelled events, RSVP, download ICS calendar files, and open Google Calendar templates. Publishing, updating, and cancelling generate per-student in-app notifications.

## Navigation delivered now

- Add **Events** and **CBT practice** to the authenticated navigation menu.
- `/events` provides the student event experience; `/cbt` provides student CBT practice.
- Keep these actions separate from Profile & settings and from the existing course quiz experience.
- Admin CMS provides separate **Events** and **CBT question bank** sections on desktop navigation and the mobile section selector.
- The Events section supports staff event authoring and management; the CBT section supports staff question authoring and management as described above.
- Preserve the existing course quiz builder and its workflow; CBT question authoring must be implemented separately.

## Events

### Student experience

- The Events page shows upcoming, in-progress, and past events, with title, description, dates, timezone, organizer, location/meeting link, and RSVP counts. Draft events are not visible to students; cancelled events remain visible as cancellations.
- Events are global to all students. Students can RSVP or change their RSVP until the event starts.
- Students can download an ICS calendar file or open a Google Calendar template.
- Publishing, updating a published event, or cancelling it creates an idempotent in-app notification for each student. Notifications are surfaced in the navbar bell; email, push, and scheduled reminders are out of scope.

### Teacher experience

- Give authorized instructors and administrators an event creation flow separate from quizzes.
- Capture title, description, start/end time, explicit IANA timezone, and optional location or HTTPS meeting link.
- Support editing and publishing drafts; published events can be updated or cancelled, while only drafts can be deleted.
- Validate date ranges and timezone on the server.
- On publish/update/cancel, notify the correct audience and keep calendar data current.

### Access, privacy, and reliability

- Enforce event permissions server-side: instructors manage their own events; administrators can manage all events.
- Enforce student visibility server-side, not only by hiding UI. Only published or cancelled events are returned to students.
- Store event timestamps consistently (UTC plus an explicit timezone where needed).
- The migration `supabase/events-notifications-migration.sql` is required for existing Supabase projects. New projects receive the schema from `schema.sql`.
- Notifications use a unique event/student/revision key to prevent duplicates. Notification read state is stored per student.

## CBT practice

CBT means a separate computer-based test system for JAMB-standard mock preparation, not an extension of the existing course quiz builder/player.

### Student experience

- Let students choose the available subject(s) and exam year before starting a practice test.
- Generate a paper from the selected subject/year question bank.
- For self-tests, let the student choose 1–200 questions per selected subject/year, subject to the published question count, and choose a duration of 15, 30, 45, 60, 90, or 120 minutes.
- For mock tests, require 60 English questions and 40 per other selected subject, with a 120-minute duration.
- Shuffle question and option order for each attempt while preserving the answer key.
- Provide a timed test with a visible countdown and a clear submission/expiry state. The server deadline is authoritative.
- Let students jump directly between questions, move forward/back, and see which questions are answered or unanswered.
- Preserve answers while navigating. Confirm before a manual submit when unanswered questions remain; submit automatically when time expires.
- On submission/expiry, show one point per correct answer with no penalty for wrong or blank answers, the correct answers and explanations, elapsed time, and average time per question.
- Allow unlimited retakes, but only one in-progress attempt per student at a time.
- Keep a student's in-progress attempt recoverable on refresh or temporary connection loss where safe and practical.

### Teacher/admin authoring

- Provide a teacher-facing CBT authoring area separate from course quizzes.
- Let authorized staff create and manage CBT questions, assign subject and year, set the correct answer, and provide optional explanation/media.
- Support drafts, review/publish status, editing, and archival so unreviewed questions are not served in live practice.
- Validate that each published question has the required choices and one valid correct answer.
- Provide a way to maintain and audit the available subjects, years, and question counts.

### Test generation, timing, and scoring

- Build attempts only from published questions for the selected subject/year; avoid repeating a question inside one attempt.
- **Resolved:** Self-test duration is selected from 15, 30, 45, 60, 90, or 120 minutes for the whole test. A mock test lasts 120 minutes.
- **Resolved:** Scoring is +1 per correct answer, with no negative marking; questions and options are shuffled; score and answer/explanation review are shown after submission; retakes are unlimited.
- Persist attempt start/end time, selected options, final score, and completion state securely.
- Treat server-side attempt state and deadlines as authoritative; do not trust a client countdown or submitted score.

### Security and integrity

- Enforce student ownership of attempts and teacher authorization for question-bank changes.
- Keep correct answers and scoring data out of APIs that serve an active attempt until reveal is allowed.
- Validate submitted question IDs and options against the specific attempt.
- Rate-limit attempt creation/submission and record audit history for teacher edits and test completion.
- Make submission idempotent and handle network retries without duplicate results.

## Confirmed product decisions

- Events are visible to all students. Students can RSVP; in-app notifications appear in the navbar. Calendar options are ICS download and Google Calendar. Email, push, and scheduled reminders are out of scope.
- Self-test durations are 15, 30, 45, 60, 90, or 120 minutes. Standard mocks are 120 minutes, with 60 English questions and 40 per other subject. Self-tests allow students to choose subjects and question counts.
- CBT scoring is one point per correct answer with no wrong-answer penalty. Questions and options are shuffled; students can review answers and pace after submission and retake without a limit.
- Instructors can author questions manually or import them and are responsible for reviewing and publishing. Questions are tagged by subject and year so students can select the material they want to attempt.

## Suggested implementation sequence

1. **Complete:** Design and implement event storage, migration, server authorization, and APIs.
2. **Complete:** Implement staff event authoring and publication lifecycle.
3. **Complete:** Implement student event listing, RSVP, calendar export, and in-app notification delivery.
4. **Complete:** Implement the teacher CBT question-bank editor and publishing workflow.
5. **Complete:** Implement subject/year selection, timed self-tests and mocks, navigation, answer persistence, submission, scoring, and review.
6. **In progress:** Focused shuffle, scoring, calendar, and answer-key privacy tests pass. Add endpoint-level authorization, expiry, retry/idempotency, and end-to-end tests before expanding CBT policies or question formats.
