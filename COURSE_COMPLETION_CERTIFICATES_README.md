# Learnpedia Course Completion Certificates

This document captures a proposed certificate feature for selected Learnpedia courses. It is a planning specification only; certificates are not implemented by this document.

## Product recommendation

Offer certificates as an optional, course-level feature. Enable them for courses where a completion record is valuable, such as professional or academic courses, rather than issuing a certificate for every course by default.

The certificate should be issued only after the learner satisfies the course's configured completion requirements. The server must verify eligibility using persisted course progress and exam results; a client-side action must never be sufficient to issue one.

## Student experience

- Clearly show when a course offers a certificate and what is required to earn it.
- Keep the certificate unavailable until all configured requirements are met.
- Issue it automatically once eligibility is confirmed, or provide a clearly labeled claim action if that is preferred.
- Let the learner download the certificate from the course completion experience and from their completed-course area, such as My Learning.
- Allow the learner to download the same issued certificate again without creating duplicate issuance records.
- Provide an optional public verification link or QR code that does not reveal unnecessary personal or academic information.

## Course eligibility settings

Allow an authorized administrator to enable certificates per course and define requirements such as:

- Completion of all required modules
- Passing a designated final exam
- A configurable minimum exam score
- Other explicitly defined course-specific requirements, if needed

Define how exam attempts count before launch. Possible policies include using the highest score or the most recent score. The selected policy must be consistent wherever eligibility is checked and shown to learners.

Do not assume that every quiz is a final exam. Identify the designated final exam explicitly and preserve the existing course quiz workflow unless a well-defined integration is needed.

## Certificate content

Potential fields for a certificate:

- Learner's display name
- Course title
- Completion or issue date
- Issuing organization or instructor
- Unique certificate ID
- Verification URL and QR code

Optional fields such as course duration, instructor name, or score should be included only if the data is reliable and there is a clear product reason to publish it.

Do not imply accreditation, licensure, formal academic credit, or recognition that Learnpedia or the course issuer is not authorized to claim. Confirm issuer wording and branding before release.

## Data and issuance model to evaluate

The final database design must follow the existing course, user, progress, and exam models. A possible design includes:

### Course certificate settings

- Whether certificates are enabled for the course
- Required completion conditions
- Designated final exam, if applicable
- Minimum passing score and attempt-selection policy
- Issuer display information or template selection, if needed

### Issued certificate record

- Unique certificate ID
- Learner and course references
- Issue timestamp
- Snapshot of the approved certificate details at issuance (for example, course title and learner display name)
- Status, such as valid or revoked
- Revocation timestamp, reason, and actor when applicable

Add appropriate uniqueness constraints so that a learner receives at most one active certificate for a course unless the product explicitly supports reissuance or versioning. Keep an audit trail for administrative changes, corrections, and revocations. Decide data-retention and account-deletion behavior before finalizing the schema.

## Eligibility and security requirements

- Perform eligibility checks on the server using trusted, persisted data.
- Verify the learner is authorized to access the course and the recorded progress belongs to that learner.
- Verify the designated final exam result and apply the configured pass and retake policy.
- Prevent duplicate issuance when requests are retried or run concurrently.
- Do not expose private exam answers, scores, or learner information through the public verification endpoint.
- Use an unpredictable or non-enumerable verification identifier; do not use sequential database IDs as public secrets.
- Restrict certificate settings and revocation actions to authorized staff.
- Record administrative changes and revocations for auditability.
- Ensure a revoked certificate is clearly shown as invalid on the verification page.

## Download and verification

Generate a PDF from the persisted issuance record so a re-download represents the same issued certificate. The PDF should include the unique ID and verification link or QR code.

The public verification page should disclose only the minimum information required to confirm validity. Decide whether it displays the learner's full name, course, and issue date, and obtain any required consent. It should distinguish valid, revoked, and unknown certificate IDs without revealing unrelated learner or course data.

## Administrative experience

Authorized administrators should be able to:

- Enable or disable certificates for a course
- Configure and review eligibility requirements
- Inspect issued certificates for a course or learner
- Correct certificate details through a controlled reissue/correction process
- Revoke a certificate with a required reason

Changes to requirements should not silently alter certificates already issued. Define whether settings apply only to future issuances and how exceptional corrections are handled.

## Decisions to confirm before implementation

1. Which courses are eligible, and who can enable certificates?
2. What exactly constitutes course completion?
3. Which exam is the final exam, and how are retakes counted?
4. Is certificate issuance automatic or learner-claimed?
5. What issuer name, branding, and certificate wording are approved?
6. Which details are shown on the PDF and public verification page?
7. Can learners request a correction, and who can approve it?
8. What happens to certificates if a course, learner account, or source record is deleted?
9. Is there any formal accreditation or academic-credit claim? If so, confirm authorization and wording before publishing.

## Suggested implementation sequence

1. Agree on the eligible courses, completion rules, exam policy, and certificate wording.
2. Trace existing course progress, quiz/final-exam results, and access control to identify authoritative server-side data.
3. Design the course settings, issuance record, uniqueness, verification identifier, and audit behavior.
4. Add server-side eligibility evaluation and idempotent certificate issuance.
5. Add authorized course settings and an administrator issuance/revocation view.
6. Add learner certificate status, download, and public verification experiences.
7. Test eligible and ineligible learners, exam retakes, missing progress, duplicate/concurrent requests, corrections, revocation, and privacy boundaries.

## Acceptance checklist

- [ ] Certificates can be enabled only for selected courses by authorized staff.
- [ ] Requirements are visible to learners before they complete the course.
- [ ] Eligibility is checked from persisted server-side progress and exam results.
- [ ] A learner who has not met every configured requirement cannot obtain a certificate.
- [ ] Retries and concurrent requests do not create duplicate active certificates.
- [ ] Re-downloading returns a certificate matching its persisted issuance record.
- [ ] Verification does not disclose unnecessary learner or exam information.
- [ ] Revoked certificates are reported as invalid.
- [ ] Administrative corrections and revocations are authorized and auditable.
- [ ] Existing course quiz behavior remains unchanged unless an explicitly tested integration is approved.

## Status

- Product proposal and implementation guide only
- No code, database migration, PDF generator, or certificate workflow is included
- Eligibility, final-exam, privacy, issuer, and retake policies remain to be decided
