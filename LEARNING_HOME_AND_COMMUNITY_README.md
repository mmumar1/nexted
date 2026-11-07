# Learnpedia Learning Home and Strings Direction

This document records the agreed product direction for evolving Learnpedia's signed-in experience. It is a planning guide; the proposed Strings experience and navigation changes are not yet implemented.

## Product direction

Learnpedia remains the learning platform. **Strings** is a distinct community and discovery module within Learnpedia: it helps people connect through what they learn, create, and contribute.

Build Strings as a modular product experience while initially sharing Learnpedia accounts, authentication, and platform infrastructure. Keep clear module boundaries so a standalone Strings app could be considered later if real usage supports it. Do not build separate identity, services, or infrastructure prematurely.

The social experience should support learning and meaningful discovery, not displace learning with engagement for its own sake. The public Learnpedia landing page remains the place to explain the product; the signed-in experience can become community-first.

## Agreed information architecture

For students, the intended primary destinations are:

### Strings

The main signed-in home and community feed. It can bring together learning-related posts, questions, project updates, achievements, and instructor contributions. The feed should help users discover useful work and people while keeping learning context clear.

### My Learning

A focused area for courses the student has enrolled in, with progress and a clear way to resume. Keep course enrollment distinct from subscription/content access, consistent with the existing data model.

### Explore Courses

A separate course catalogue for finding courses and taking an enrollment action. Course listings should not dominate the Strings feed or appear as a large catalogue on the signed-in home. Users can choose **My Learning** or **Explore Courses** when they want to see courses.

Course details and learning activities remain reachable after a user selects a course. This navigation change is about clearer destinations, not removing courses or weakening access controls.

Notifications and existing course messages should remain easy to reach from the navigation. Mobile navigation should expose the same destinations without overcrowding the navbar.

### Role-aware experience

Strings is primarily described from the student perspective, but instructors may contribute learning content and participate under clear role labels and permissions. Instructors and administrators must retain their teaching and management destinations; the community home must not replace or weaken admin tools or role-based access.

## Signed-in entry and transition

The intended destination after login is the Strings feed, once a useful and safe first version is ready. Do not redirect users to an empty or unfinished feed. Until then, preserve the current working dashboard. Plan and test the transition for login, registration, and existing dashboard links together.

The current public landing page and the authenticated home serve different purposes:

- Public landing: explain Learnpedia and provide sign-in/registration entry points.
- Signed-in student home: Strings feed when the first release is ready.
- My Learning: enrolled courses and learning progress.
- Explore Courses: course discovery and enrollment.

## Content and product boundaries

### Feed

Start with a learning-oriented, chronological feed rather than a personalized ranking system. Potential durable post types include:

- Learning questions, tips, and reflections
- Project updates and work in progress
- Achievements and learning milestones
- Instructor learning guidance
- Course-related discussion with clear course context

Projects already exist in Learnpedia. Integrate or link them into Strings where appropriate rather than rebuilding the project feature without a product need.

Important course announcements must remain clearly identified and reliably available to their intended audience. Do not make official announcements depend on feed ranking or users scrolling past unrelated posts.

### Stories

Stories are a possible later format, not a prerequisite for the first Strings release. They could make short-lived learning updates more visible, but should follow a stable feed and baseline safety/moderation capabilities.

Before building Stories, decide whether they expire, can be archived, or become durable profile/portfolio entries; who can view and reply; and how users can report or control visibility. Keep temporary Stories distinct from durable project and achievement posts so valuable work is not lost by default.

### GitHub-like contribution flow

Borrow the useful idea of making progress and contributions visible: project showcases, learning milestones, and a portfolio of work can help people discover each other through their contributions. This is inspiration for the learning experience, not a requirement to copy GitHub's interface or workflows, or to make Strings only about software development.

### Messaging

Keep the existing messaging system course-scoped: it connects a student and the instructor responsible for a course. It is not currently general student-to-student or mentor direct messaging. See [CHAT_IMPLEMENTATION.md](./CHAT_IMPLEMENTATION.md).

Do not rebuild or silently repurpose course conversations as social direct messages. General student or mentor messaging is a separate future capability that needs its own contact rules, requests, blocking/reporting, notifications, and safeguards for adult-to-minor contact.

## Current implementation context

- The authenticated home is currently the course-focused dashboard.
- The navbar already has course-related destinations and separates enrolled courses from course exploration.
- A Projects feature and course-scoped instructor messaging exist.
- The Strings feed, social profiles, follows, Stories, and general social messaging described here are future work, not existing functionality.

Implementation planning should verify current routes, components, enrollment and access behavior, authentication roles, notifications, data policies, and responsive navigation before proposing code or migrations.

## Recommended delivery stages

These are sequencing recommendations, not a commitment to build every feature.

### Stage 0 — Product and safety foundations

- Audit current dashboard, navigation, roles, profile data, projects, course enrollment/access, announcements, and messaging.
- Confirm the first-release audience, post visibility, course-context rules, moderation ownership, and school/instructor permissions.
- Define age-appropriate privacy defaults and safeguarding requirements before enabling student-generated content or adult-to-minor contact.
- Prototype Strings, My Learning, and Explore Courses navigation, including mobile layouts.
- Keep current course data and course messaging behavior intact during the transition.

### Stage 1 — Strings foundation

- Create a distinct Strings home/feed module within Learnpedia.
- Start with a simple chronological, learning-focused feed and clear author identity and post context.
- Establish authentication, authorization, input validation, reporting, moderation, and abuse-prevention requirements as part of the launch scope.
- Make projects and learning activity discoverable without duplicating existing project or course records unnecessarily.
- Do not require Stories, feed ranking, general messaging, or a standalone app for this stage.

### Stage 2 — Learning navigation and useful interactions

- Make Strings the student landing destination only after the feed is ready and tested.
- Provide separate My Learning and Explore Courses destinations; keep the catalogue out of the default feed.
- Add selected interactions such as following, reactions, and comments only with their privacy, reporting, blocking, and notification behavior defined.
- Measure whether community use supports learning and discovery, not only time spent in the feed.

### Stage 3 — Stories and richer identity

- Consider Stories after the feed and moderation processes are working.
- Add richer student portfolios, project and achievement presentation, and discovery based on interests if validated by users.
- Define how temporary Stories differ from durable profile or project content.

### Stage 4 — Broader ecosystem

- Explore school and organization profiles, opportunities, mentorship, and additional community capabilities in response to demonstrated needs.
- Defer general social messaging until a safe and explicit permission model is approved.

### Stage 5 — Consider standalone Strings

Evaluate a separate web/mobile Strings application only when usage, engagement, support needs, and product strategy justify the operational cost. Reuse shared accounts and learning integrations where appropriate. Modularity now should reduce future separation cost, not force a premature service split.

## Safety, privacy, and moderation

Safety is a release requirement for any feature that lets students publish or interact with user-generated content. Define and test:

- Post and profile visibility, including safe defaults for minors
- Reporting of content and accounts, moderation review, escalation, and audit history
- Blocking and protections against unwanted contact
- Rate limits, spam prevention, and content removal/retention rules
- Appropriate school and parent/guardian permissions where required
- Clear explanations of what student information is visible and why
- Separation of service communications from marketing consent

Do not expose student data to schools, organizations, mentors, or other users by default. Any future school or organization access needs a specific authorization model and data-minimizing design.

## Decisions to settle before implementation

- Who may join and publish in the first release, and how role eligibility is verified
- Whether the first feed is visible to all authenticated users or limited by school/course
- What profile details are public, private, or unavailable for minors
- How posts are edited, deleted, retained, and moderated
- Which course announcements or activities may appear in Strings and how they are labeled
- What mobile navigation pattern presents Strings, My Learning, and Explore Courses
- Whether Stories expire, can be archived, or can be converted into portfolio entries
- What evidence would justify adding general messaging or a standalone Strings app

## Success measures

Choose baselines and reporting windows before launch. Useful measures include:

- Time to resume an enrolled course
- Course discovery-to-enrollment rate
- Course progress and completion
- Students returning to learn after contributing or discovering a post
- Useful project, question, or learning-content contributions
- Feed reports, spam rates, and moderation response time

Do not optimize for feed activity alone if it distracts from learning outcomes or student safety.

## Status

- Product direction agreed: Strings as a distinct module inside Learnpedia, with shared accounts and infrastructure initially.
- Intended student navigation agreed: Strings home, My Learning, and Explore Courses.
- Stories and standalone Strings apps are future considerations, not first-release requirements.
- Course-scoped instructor messaging remains in place; general social messaging is deferred.
- This document is a planning guide. No application functionality is implemented by this document.
