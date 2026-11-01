# Learnpedia Feature Priorities

This is the current cross-feature priority list. It consolidates previously discussed work and distinguishes shipped features from plans and new ideas. Priorities are recommendations, not approval to begin work.

## Five tracked feature threads

| Priority | Feature | Status | Recommended next action |
|---|---|---|---|
| 1 | **Course-scoped student–instructor messaging** | MVP implemented in the repository: private per-course conversations, authenticated API, instructor inbox, unread state, polling, and migration/RLS. The live Supabase migration and deployment verification are still pending. See [CHAT_IMPLEMENTATION.md](./CHAT_IMPLEMENTATION.md). | Review and apply the messaging migration to the intended Supabase project, then verify the student/instructor flows with real accounts. |
| 2 | **English lesson narration (Beta)** | Browser Speech Synthesis is implemented for students, with Play/Pause/Resume/Stop controls and a teacher preview in the module editor. No TTS API, key, or audio storage is required. Hausa and other languages are deferred. See [MULTILINGUAL_AUDIO_README.md](./MULTILINGUAL_AUDIO_README.md). | Collect teacher/student feedback on device voice quality and math narration before evaluating provider-backed generated audio. |
| 3 | **Course completion certificates** | Planning only. The concept is documented in [COURSE_COMPLETION_CERTIFICATES_README.md](./COURSE_COMPLETION_CERTIFICATES_README.md). | Confirm course eligibility rules and final-exam policy, then define issuance and verification requirements. |
| 4 | **Events and in-app event notifications** | Feature implementation is complete. Existing Supabase projects still need the Events migration applied and the live flows verified. See [EVENTS_AND_CBT_IMPLEMENTATION.md](./EVENTS_AND_CBT_IMPLEMENTATION.md). | Apply the migration to the intended Supabase project and verify staff publishing, student RSVP, and notification read state in production. |
| 5 | **CBT practice engine** | Student JAMB/UTME and WAEC/NECO exam cards, topic/year self-tests, fixed English-included mocks, and teacher bulk classification are implemented. Apply the CBT exam/topics migration and verify with real accounts before release. | Run [CBT exam and topic migration](./supabase/cbt-exam-topics-migration.sql), classify existing questions, then verify the student and teacher flows. |

### Messaging delivery

CBT and Events have already received substantial implementation. Course messaging has now moved from a navbar placeholder to an MVP. Keep it course-scoped—not a general chat—and do not expose it in production until the migration and real-account checks in its guide are complete.

## Other discussed work already delivered

- **Payments and manual payment approval:** Implemented, including admin approval controls. Continue operational testing and verify payment/subscription migrations as needed.
- **Responsive navigation and dark mode:** The mobile menu, notification and leaderboard entry points, message placeholder, and dark-mode toggle are implemented.
- **Login redesign:** The revised sign-in layout is applied to both the landing-page modal and direct `/login` route.
- **Vercel API runtime reliability:** A recurring ESM alias issue was fixed by using explicit relative `.js` imports. Keep the build-and-API smoke checks in [VERCEL_API_RUNTIME_TROUBLESHOOTING.md](./VERCEL_API_RUNTIME_TROUBLESHOOTING.md).
- **Beta features:** English lesson narration, course messaging, and the updated CBT practice setup are currently labeled Beta in their student/teacher entry points.

## New candidates not covered by the existing feature plans

These are ideas for product discovery, not approved implementation scope:

1. **Course feedback and evaluation:** Let learners submit structured course feedback after meaningful progress or completion. Define moderation, instructor visibility, and whether feedback is private before adding public ratings.
2. **Accessibility and lesson alternatives:** Audit keyboard/screen-reader usability and add captions or transcripts where course media lacks them. Prioritize barriers found in the audit rather than adding an unvalidated feature bundle.

## Release checks before starting the next feature

- Apply and verify outstanding Supabase migrations against the intended project.
- Run type-check, focused tests, and a production build.
- After deployment, smoke-test the relevant API endpoints; a successful Vercel build does not prove that serverless APIs start correctly.
- Do not commit local credentials or `LOCAL_TEST_ACCOUNTS.md`.
