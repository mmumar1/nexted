# Learnpedia Learning Home and Community Concept

This document captures an early product idea for a future Learnpedia redesign. It is for discussion and planning only: none of the functionality below is implemented or approved as a final specification.

## Product direction

Explore evolving the post-login experience from a primarily course-focused dashboard into a learning home where students can continue their studies, discover other courses, and participate in a learning community.

Use familiar community-product patterns as inspiration, but do not copy another platform's interface directly. The experience should remain focused on learning and make each student's next learning action easy to find.

## Possible main destinations

### Home

A relevant learning feed containing posts from students and instructors. Possible post types include:

- Study questions and learning tips
- Learning milestones
- Instructor updates
- Course-related discussions

The feed should complement the formal learning experience. Important course announcements should remain clearly identified and reliably available to their intended audience rather than getting lost in a general feed.

### My Learning

A dedicated place for courses the student is taking, including:

- A clear way to resume a course
- Course progress and completion state
- Recently accessed or in-progress courses

### Explore Courses

A catalogue of courses the student is not currently taking. Potential capabilities:

- Search
- Useful filters, such as subject, level, instructor, and price (confirm which fields exist and matter)
- Pagination or a load-more pattern for a large catalogue
- A clear action to view course details and enroll, subject to the existing access/payment rules

The definition of “currently taking” must be agreed and implemented consistently with the existing enrollment, subscription, and course-access model.

## Navigation ideas

- Keep Home, My Learning, and Explore Courses as the primary destinations.
- Keep notifications and messages accessible from the top navigation.
- On phone screens, make the main destinations easy to reach without overcrowding the top navbar; choose an appropriate mobile navigation pattern during design.
- Preserve clear role-based behavior for students, instructors, and administrators. The initial idea primarily describes the student experience.

## Recommended initial scope

Start with the information architecture and a focused learning home:

1. Home feed with simple text posts, author identity, timestamp, and optional course association.
2. Clear distinction between student and instructor posts.
3. My Learning view focused on progress and resuming a course.
4. Explore Courses view that excludes courses the student is already taking and supports search/filtering and pagination or load more.
5. Existing course announcements and messages remain accessible and do not get silently replaced by feed content.

Consider postponing comments, reactions, images, ranking/personalized algorithms, and other advanced social features until the basic experience has been validated.

## Decisions needed before implementation

### Feed audience and permissions

- Are posts visible to all authenticated Learnpedia users, only members of a course, or an audience selected by the author?
- Can authors choose visibility, and if so, which options are safe and understandable?
- Can students post from the first release, or should the first version be instructor-only?
- Are posts associated with a course, and who is allowed to post to that course?
- How do edits, deletion, and retention work?

### Safety and moderation

If students can publish content to other users, define before launch:

- Reporting and moderation workflow
- Spam and inappropriate-content handling
- Blocking or other user-safety controls, if needed
- Who can remove content and how moderation decisions are audited
- Rate limits and other abuse-prevention measures

### Course discovery

- Which course attributes support useful search and filters?
- What exact rule identifies a course as one the user is taking?
- How do paid courses, subscription access, enrollment, archived courses, and completed courses appear?
- Should results be paginated, loaded incrementally, or both?

### Notifications and announcements

- Which feed activity creates a notification, if any?
- How are course announcements distinguished from community posts?
- What notification preferences and delivery channels should be supported?

## UX and product principles

- Keep the primary student goal—learning—more prominent than social activity.
- Do not make important course content depend on feed ranking or scrolling.
- Clearly label author role, course context, and post visibility.
- Provide useful empty, loading, and error states.
- Keep mobile navigation usable on narrow screens.
- Avoid showing fake activity, fabricated counts, or unread indicators that are not backed by real state.

## Potential implementation phases

These are candidate phases, not a committed delivery plan:

1. Review current dashboard, enrollment/access logic, announcements, notifications, and responsive navigation.
2. Agree on audience, permissions, moderation, and what counts as an active course.
3. Prototype and validate the Home / My Learning / Explore information architecture.
4. Implement Explore Courses and My Learning using the established course-access model.
5. Design and implement a minimal feed, including authorization and moderation controls, if the product decisions support it.
6. Add richer interactions only after usability and safety needs are understood.

## Future success measures

Choose measurable goals before implementation. Potential indicators include:

- How quickly a student resumes an in-progress course
- Course discovery-to-enrollment rate
- Student return rate and course completion
- Feed usefulness and contribution quality
- Reports, moderation response time, and spam rates

Do not optimize for feed engagement alone if it distracts from learning outcomes.

## Status

- Product concept only
- No implementation requested or performed
- Major behavior, access, moderation, and navigation decisions remain open
