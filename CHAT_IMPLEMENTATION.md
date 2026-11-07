# Course Messaging

## MVP behavior

Messaging is private and course-scoped, not a general chat:

- A student can start or reopen one conversation per published course from that course's page.
- Instructors can access conversations only for courses currently assigned to them.
- An administrator can access a conversation only when assigned as that course's instructor.
- The navbar links to the inbox and shows persisted unread-message counts.
- The inbox and open thread refresh by polling; Supabase Realtime and file attachments are not used.
- Message bodies are trimmed and limited to 4,000 characters. Threads return the latest 100 messages.

The current dashboard treats all published courses as accessible, so messaging follows that same rule. If course enrollment/access rules become more restrictive, update the server-side messaging authorization at the same time.

## Relationship to Strings

Strings is planned as a distinct community module inside Learnpedia, initially sharing its accounts and platform infrastructure. The future Strings direction is documented in [LEARNING_HOME_AND_COMMUNITY_README.md](./LEARNING_HOME_AND_COMMUNITY_README.md).

This implementation remains course-scoped messaging between a student and the instructor assigned to a course. Strings does not currently provide general student-to-student or mentor direct messaging. Do not replace or broaden the existing conversation model as part of the Strings feed or navigation work.

If general Strings messaging is considered later, treat it as a separate product capability with explicit conversation permissions, message requests or contact rules, blocking and reporting, notification behavior, and safeguards for adult-to-minor interactions. Reuse shared messaging infrastructure only where the authorization and safety models fit; never infer permission from a follow relationship.

## Security and data model

The authenticated Supabase bearer token determines the requester; client-provided user, role, instructor, and sender IDs are not trusted. Each API operation checks the current course publication state and conversation membership. Instructor access is derived from the course's current `instructor_id`, so reassignment removes the former instructor's access.

`course_conversations` has a unique `(course_id, student_id)` constraint. `course_messages` stores the sender, bounded body, creation time, and nullable read time. Both tables have foreign keys, indexes, RLS policies, and server-side authorization. The server uses the service-role storage adapter, so its checks remain required even with RLS enabled.

## Apply to an existing Supabase project

The messaging migration is **not applied automatically** and has not been applied to a live project as part of this implementation. Review and apply [the migration](./supabase/migrations/20260616000000_course_messaging.sql) to the intended Supabase project before using the feature. For a new project, the table definitions are also in [schema.sql](./supabase/schema.sql), with policies in [rls.sql](./supabase/rls.sql).

Do not expose the Supabase service-role key to the client. No Realtime publication or Storage bucket setup is required for this MVP.

## API

- `GET /api/messages`: list the authenticated participant's accessible conversations.
- `POST /api/messages/course/:courseId`: idempotently open a student's conversation for a published course.
- `GET /api/messages/:id`: verify membership, mark incoming messages read, and return the latest 100 messages.
- `POST /api/messages/:id`: verify membership and save a message with the authenticated sender.

## Verification checklist

- [x] One conversation per student/course; opening again returns the existing conversation.
- [x] Server verifies student ownership or current instructor assignment on every read and write.
- [x] Students cannot message unpublished courses or courses without an instructor.
- [x] Message length and thread history are bounded.
- [x] Read state is persisted; inbox and thread poll without Realtime.
- [x] Unit tests cover course publication, student ownership, and current instructor assignment.
- [ ] Apply the migration to the target Supabase project and verify both RLS and API behavior there.
- [ ] Manually test student and instructor messaging with real accounts after deployment.
