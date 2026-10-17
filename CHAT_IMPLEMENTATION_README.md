# Course Messaging Implementation Guide

This document describes the planned student-to-instructor messaging feature. It separates the initial navigation UI from the later chat implementation, which will be considered after the Supabase plan and project limits have been reviewed.

## Product decision

Messaging is course-scoped, not a general-purpose chat:

- A student starts a conversation from a course they can access.
- The conversation is with that course's assigned instructor/course creator.
- A student may have separate conversations for separate courses.
- The navbar message icon is an inbox entry point for conversations across the user's courses.
- Instructors see conversations for courses assigned to them.

## Phase 1: Message icons only

Add a message icon to the navbar for both student and instructor accounts.

### Scope

- Render the icon for authenticated students and instructors.
- Keep it visually consistent with the existing responsive navbar icons.
- Make the icon keyboard accessible and provide an accessible label such as "Messages".
- On activation, show a clear "Messaging coming soon" notice or an equivalent non-functional placeholder.
- Do not send or store messages, create conversations, show fabricated message previews, or display a misleading unread count.
- Do not expose a general chat interface.
- Do not add a course-level chat action in this phase.

The icon is only a navigation placeholder until the messaging backend is ready. No realtime, database, or Supabase messaging configuration is required for Phase 1.

## Phase 2: Course-scoped messaging

Begin this phase after confirming the Supabase plan, project configuration, expected usage, and current feature limits. Do not assume a plan upgrade alone configures messaging; verify database, realtime, storage, and security requirements before enabling the feature.

### Student experience

- Show a "Message instructor" action on each course the student is authorized to access.
- Open the conversation associated with that student and course.
- Let the student send and view messages with that course's instructor.
- Show the student's conversations in the navbar inbox, grouped or labeled by course.
- Display real unread indicators only when unread state is implemented and persisted.

### Instructor experience

- Let instructors open an inbox from the navbar.
- Show conversations only for courses assigned to that instructor.
- Identify the course and student for each conversation.
- Let the instructor respond in the course-specific thread.

### Authorization and privacy

- Enforce all permissions on the server and in Supabase Row Level Security (RLS); hiding UI is not authorization.
- Verify the authenticated student has access to the course before listing or writing messages.
- Verify the authenticated instructor is assigned to the course before listing or responding.
- Do not allow users to change `student_id`, `instructor_id`, or `course_id` to gain access to another conversation.
- Keep messages private to the student and instructor for that course.
- Decide explicitly whether administrators need access before granting them any messaging visibility.

## Data model to evaluate

Use the existing course, profile, role, and course-access model as the source of truth. A possible initial relational design is:

### `course_conversations`

- `id`: UUID primary key
- `course_id`: reference to the course
- `student_id`: reference to the student profile
- `instructor_id`: reference to the assigned instructor profile
- `created_at`, `updated_at`: timestamps
- Unique constraint on `(course_id, student_id)` if there should be one conversation per student per course

### `course_messages`

- `id`: UUID primary key
- `conversation_id`: reference to the conversation
- `sender_id`: reference to the sender profile
- `body`: message text, with server-side length and content validation
- `created_at`: timestamp
- `read_at`: nullable timestamp if read receipts/unread counts are included

This is a proposed starting point, not a migration. Confirm deletion/retention behavior, message limits, attachments, and read receipts before finalizing the schema. Avoid attachments in the first functional release unless there is a clear requirement and storage/security design.

## Suggested implementation sequence

1. Confirm the course conversation rules, including whether an instructor can change after a conversation starts.
2. Review Supabase plan limits and decide whether messages are stored in the existing database and whether Realtime is needed.
3. Design and apply database migrations, indexes, foreign keys, and RLS policies.
4. Add server-validated operations to list conversations, read messages, send a message, and mark messages read.
5. Add the course-level student entry point and the student/instructor inbox views.
6. Connect the navbar message icon to the inbox and add accurate unread state.
7. Add pagination, input limits, loading/error states, and appropriate rate limiting.
8. Test student, instructor, unauthorized, course-access, and cross-course cases before release.

## API behavior to define

Potential operations (adapt to the project's established route patterns):

- List the authenticated user's conversations.
- List messages for a conversation after verifying conversation membership.
- Send a message after validating sender identity and course-conversation access.
- Mark messages read after verifying the recipient is an authorized participant.

Never trust user IDs, course IDs, roles, or instructor assignments supplied by the client without checking them against the authenticated server-side identity and database records.

## Future acceptance checklist

- [ ] A student with course access can start or open only their conversation for that course.
- [ ] A student cannot read or send messages in another student's conversation.
- [ ] An instructor can access only conversations for courses assigned to them.
- [ ] The navbar inbox displays only conversations the signed-in user may access.
- [ ] Unread counts reflect persisted unread messages and update correctly.
- [ ] Loading, empty, send failure, and permission-denied states are clear.
- [ ] RLS and server checks prevent unauthorized access even when requests bypass the UI.
- [ ] Automated tests cover allowed and denied student/instructor access.
