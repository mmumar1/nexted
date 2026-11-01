# Multilingual Lesson Audio and Translation

This document records the proposed direction for lesson narration and translation in Learnpedia. It is a planning document only: the feature is not implemented, and it does not authorize code, schema, or migration changes.

## Product direction

Let an authorized teacher request reusable language support for a saved lesson. The agreed language direction is:

- **English:** generate spoken narration from the English lesson text.
- **Hausa:** translate the English lesson into Hausa.
- **Yoruba and Igbo:** keep these as planned language options, subject to provider and quality validation before they are offered.
- **Nigerian Pidgin:** out of scope.

The initial baseline is English audio plus Hausa translated text. Whether Hausa, Yoruba, and Igbo translations should also have generated audio is an open product decision; do not imply that a usable TTS voice exists until it has been tested with native speakers. If translated audio is required for the first release, confirm Hausa voice quality before implementation begins.

Keep the original lesson and its existing reading experience unchanged. Translations and audio are optional additions, not replacements for the lesson.

## Current application context

- Lesson/module content is Markdown stored in `modules.content`.
- Teachers create and edit modules through the existing admin CMS and authenticated module endpoints.
- Student lesson content is rendered in the course module view.
- The Markdown renderer supports math syntax and KaTeX display rendering.
- Course/module access is already role- and enrollment-sensitive; generated content must follow those access rules.

The implementation should reuse the existing module save, authorization, and lesson-rendering patterns rather than creating a separate lesson system.

## Recommended processing flow

1. A teacher saves a module and explicitly requests English narration and/or Hausa translation.
2. The server verifies that the requester is authorized to manage that course and module.
3. A background job snapshots the saved content and its version, extracts narration-ready text, and prepares math for speech.
4. The translation and speech tasks run separately so either can succeed or fail without falsely reporting the other as complete.
5. Store generated audio privately and translation text with metadata linking each result to the module content version and processing configuration.
6. Show clear status to the teacher. Make ready outputs available to students only after the server verifies their access to the course/module.
7. Reuse an existing result when its source version and configuration match. Lesson edits make older outputs stale; they should not regenerate automatically.

Generation should run asynchronously rather than holding an API request open. Supabase Queues is a possible durable queue because the application already uses Supabase, but worker deployment, retries, monitoring, and operational ownership must be chosen during implementation design.

## Data model to evaluate

Do not add this schema until implementation is approved. A possible generated-asset record would include:

- Module reference and requested language
- Source-content hash/version
- Output type (translation text or audio)
- Pipeline/configuration version
- Translation provider/model, where applicable
- TTS provider, voice, and model, where applicable
- Status: queued, processing, ready, failed, or stale
- Private storage path, MIME type, size, and duration for audio
- Requesting teacher, timestamps, and actionable failure information

Use an idempotent identity based on the module, source hash, output language/type, and relevant provider/configuration. Do not treat generated assets as authoritative lesson content. Decide whether obsolete assets are retained for rollback/audit or removed after a retention period.

## Math and Markdown handling

KaTeX is used to display math; its rendered output is not necessarily suitable narration. Do not strip LaTeX with regular expressions or alter the saved lesson as a side effect of audio generation.

Before implementation:

- Parse Markdown into structured content, preserving prose, headings, lists, and math nodes.
- Evaluate a math-to-speech approach using representative lessons and target-language reviewers.
- Allow teacher review or editing of the spoken form for ambiguous or important equations.
- Keep code blocks, tables, links, and other non-prose content from becoming confusing narration.

## Provider and language validation

No provider has been selected. Translation support does not guarantee TTS support, and a locale listed by a provider does not establish that its voice is understandable for Learnpedia learners.

Before choosing providers:

- Test English narration voices with lesson terminology and math.
- Test Hausa translation quality and Hausa TTS separately if Hausa audio is in scope.
- For Yoruba and Igbo, confirm both translation and TTS availability independently.
- Have fluent speakers assess pronunciation, tone, vocabulary, and educational meaning.
- Check provider terms for generated educational content, data handling, retention, and voice usage.
- Confirm production pricing, rate limits, output formats, and regional availability.

Use human review as a release gate for each language. If an acceptable synthetic voice is unavailable, keep translated text as the supported option rather than shipping poor-quality audio.

## Security, cost, and reliability

- Keep provider credentials on the server; never expose them in browser code.
- Store audio in a private bucket. Use short-lived signed URLs or server-authorized streaming after checking learner access.
- Do not allow direct client access to queue messages or privileged storage paths.
- Deduplicate requests and cap generation by course/teacher to prevent accidental repeated charges.
- Track usage and surface provider failures explicitly; retries must be bounded and safe.
- Define deletion behavior when a module, course, or user is removed.

Costs depend on the selected providers, voices, output length, retries, storage, and playback. As an illustration only, a 20-module course averaging 5,000 source characters per module has 100,000 characters:

- One English audio rendition per module is about 100,000 synthesized characters.
- One Hausa translation per module is about 100,000 source characters sent for translation.
- At the currently published Google Standard/WaveNet list rate of $4 per million characters with 4 million characters/month free, the English synthesis is below that monthly free allowance.
- Google Cloud Translation lists the first 500,000 characters/month as free and $20 per million above that; the example is also below that threshold if the applicable model supports the language.

These are list-price examples, not provider recommendations or guaranteed Hausa coverage. Confirm current pricing and supported language/model combinations before budgeting. Storage and egress costs should be estimated from the selected audio format, duration, and expected student listening.

## Teacher and student experience

### Teacher

- Place generation controls in the existing module editor after the module is saved.
- Offer distinct actions for English narration and Hausa translation.
- Show per-output status, source version, last generated time, and useful failure/retry information.
- Allow preview and explicit regeneration of stale outputs.
- Require confirmation or enforce quotas before starting potentially billable work.

### Student

- Preserve the normal lesson content and make language outputs optional.
- Show language choices only when the corresponding output is ready.
- Provide accessible playback controls for audio: play/pause, seek, playback speed, and keyboard support.
- Clearly label translated text and generated speech; do not silently substitute one for the other.

## Suggested rollout

1. **Proof of concept:** use representative English lessons, including equations, and generate English audio plus Hausa translated text.
2. **Human review:** evaluate translation meaning, narration clarity, and math pronunciation with appropriate speakers.
3. **Technical validation:** test latency, job retries, stale-version behavior, private access, and actual provider costs.
4. **Initial release:** enable only the outputs that pass quality and access-control checks.
5. **Language expansion:** validate Yoruba and Igbo translation and voice support separately before adding them to the learner interface.

## Decisions required before implementation

- Should Hausa translation be text-only at first, or should Hausa audio be required for the first release?
- Are Yoruba and Igbo launch requirements or later expansion targets?
- Who reviews and approves generated translations/audio, and can teachers edit or replace them?
- Should teacher requests be limited by course, user, or monthly character budget?
- How long should stale and failed assets be retained?
- Which background worker/queue and private audio storage arrangement fits the production deployment?
- What should students see while an output is processing, stale, unavailable, or failed?

## References

- [Supabase Queues](https://supabase.com/docs/guides/queues)
- [Google Cloud Text-to-Speech pricing](https://cloud.google.com/text-to-speech/pricing)
- [Google Cloud Translation pricing](https://cloud.google.com/translate/pricing)
- [Azure Translator language support](https://learn.microsoft.com/en-us/azure/ai-services/translator/language-support)
- [Azure Speech language and voice support](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support)
