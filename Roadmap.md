# AT-School LMS Revamp - Implementation Roadmap

## Overview
This roadmap outlines the step-by-step implementation of the AT-School LMS revamp, transforming it into a production-ready, Moodle-like learning management system with Supabase authentication, role-based access control, CMS capabilities, notifications, and AI-powered learning assistance.

---

## 📊 Timeline & Phases

### **Phase 1: Authentication & Authorization Setup** (Week 1)
**Objective**: Integrate Supabase Auth and establish role-based access control

#### Tasks:
- [ ] Set up Supabase project and PostgreSQL database
- [ ] Configure Supabase environment variables (.env.local)
- [ ] Create authentication schema extensions:
  - [ ] Add `role` enum (admin, instructor, student) to auth.users
  - [ ] Add `avatar_url`, `created_at`, `updated_at` to users table
- [ ] Implement Supabase Auth middleware in Express
  - [ ] JWT token validation
  - [ ] User context injection into `req.user`
  - [ ] Role-based middleware for admin/instructor routes
- [ ] Update login/signup routes
  - [ ] Replace Passport with Supabase Auth
  - [ ] Handle session management
  - [ ] Implement logout with token revocation
- [ ] Frontend updates:
  - [ ] Integrate Supabase client in React
  - [ ] Update login/signup forms to use Supabase Auth
  - [ ] Add authentication context/provider
  - [ ] Update navigation based on auth state

**Deliverables**:
- Supabase integration complete
- Authentication flows working
- Session management functional
- Role information accessible in app

---

### **Phase 2: Database Schema Enhancement** (Week 2)
**Objective**: Extend database with new tables and relationships for modern LMS features

#### Tasks:
- [ ] Create/update database tables:
  - [ ] **courses** - Add `instructor_id`, `description`, `created_at`, `updated_at`
  - [ ] **modules** - Add `prerequisite_module_id`, `duration`, enhance content field
  - [ ] **user_courses** (Enrollments) - Add `progress`, `enrolled_at`, `completed_at`
  - [ ] **module_completions** - Add `time_spent`, `score`, `updated_at`
  - [ ] **notifications** (NEW)
    ```
    id, user_id, type, title, message, related_id, read, created_at
    ```
  - [ ] **achievements** (NEW)
    ```
    id, user_id, type, earned_at, badge_url
    ```
  - [ ] **notifications_preferences** (NEW)
    ```
    user_id, email_on_enrollment, email_on_completion, in_app_notifications
    ```

- [ ] Create database migrations using Drizzle ORM
- [ ] Add foreign key constraints and indexes
- [ ] Seed initial data (demo courses with modules/quizzes)
- [ ] Update TypeScript schema types in `shared/schema.ts`

**Deliverables**:
- All new tables created and indexed
- Type definitions updated in codebase
- Migrations can be replayed
- Database normalized and optimized

---

### **Phase 3: Enrollment & Access Control** (Week 3)
**Objective**: Implement enrollment-based access and module prerequisite unlocking

#### Tasks:
- [ ] Backend API endpoints:
  - [ ] `POST /api/courses/:courseId/enroll` - Enroll user (requires access code or admin approval)
  - [ ] `GET /api/courses` - Return only enrolled courses for non-admin users
  - [ ] `GET /api/courses/:courseId` - Verify enrollment before returning
  - [ ] `GET /api/courses/:courseId/modules` - Return modules with unlock status
  - [ ] `GET /api/modules/:moduleId` - Check prerequisites, return unlock requirements if locked
  - [ ] `POST /api/modules/:moduleId/complete` - Mark module complete and unlock next
  - [ ] `GET /api/users/me/enrollments` - Get user's enrolled courses with progress

- [ ] Middleware:
  - [ ] `requireAuth()` - Verify JWT token
  - [ ] `requireRole(role)` - Check user role
  - [ ] `requireEnrollment(courseId)` - Verify user is enrolled
  - [ ] `isModuleUnlocked(userId, moduleId)` - Check prerequisites

- [ ] Update `storage.ts` with Supabase implementation:
  - [ ] Replace in-memory storage with Supabase queries
  - [ ] Implement enrollment validation
  - [ ] Add prerequisite checking logic

**Deliverables**:
- Users can only access enrolled courses
- Modules lock/unlock based on prerequisites
- Access control fully functional
- API returns appropriate status codes (403, 404)

---

### **Phase 4: Notifications System** (Week 4)
**Objective**: Build real-time notifications for user activities

#### Tasks:
- [ ] Backend:
  - [ ] Create notification service (`server/services/notificationService.ts`)
  - [ ] Implement notification creation:
    - [ ] Enrollment notifications
    - [ ] Module completion notifications
    - [ ] Achievement unlocked notifications
    - [ ] Quiz passed/failed notifications
  - [ ] API endpoints:
    - [ ] `GET /api/notifications` - Get user notifications (paginated)
    - [ ] `PUT /api/notifications/:notificationId/read` - Mark as read
    - [ ] `PUT /api/notifications/read-all` - Mark all as read
    - [ ] `DELETE /api/notifications/:notificationId` - Delete notification
  - [ ] WebSocket integration (socket.io or Supabase Realtime)
    - [ ] Real-time notification delivery
    - [ ] Broadcast notification count updates

- [ ] Frontend:
  - [ ] Create Notifications Center component
    - [ ] Notification list with filtering (read/unread)
    - [ ] Notification timestamps
    - [ ] Delete/mark as read actions
  - [ ] Add Notification Bell to Navbar
    - [ ] Unread count badge
    - [ ] Dropdown preview (last 5 notifications)
    - [ ] Link to full notification center
  - [ ] Toast system enhancements
    - [ ] Toast on course enrollment
    - [ ] Toast on module completion
    - [ ] Toast on achievement unlock
  - [ ] Real-time updates via WebSocket

**Deliverables**:
- Notifications created on key events
- Users can view notification history
- Real-time updates working
- Navbar shows unread notification count

---

### **Phase 5: AI Learning Assistant** (Week 5)
**Objective**: Integrate AI-powered learning assistance

#### Tasks:
- [ ] Backend:
  - [ ] Create AI service (`server/services/aiService.ts`)
  - [ ] Integration with OpenAI/Claude API
    - [ ] Initialize client with API key
    - [ ] System prompt for educational context
  - [ ] API endpoints:
    - [ ] `POST /api/ai/chat` - Send message, get AI response
    - [ ] `GET /api/ai/chat-history/:moduleId` - Get chat history for a module
  - [ ] Context enrichment:
    - [ ] Include current module content in AI context
    - [ ] Include user progress/course info
    - [ ] Implement token-based rate limiting

- [ ] Frontend:
  - [ ] Create AI Chat Modal component
    - [ ] Chat message display
    - [ ] Input field with send button
    - [ ] Loading state during response
    - [ ] Error handling
  - [ ] Add AI button to Navbar
    - [ ] Icon (e.g., sparkles, lightbulb)
    - [ ] Click to open chat modal
    - [ ] Show "Ask for help" tooltip
  - [ ] Chat features:
    - [ ] Message history within session
    - [ ] Context-aware prompts
    - [ ] Ability to reference current module
    - [ ] Copy/share responses

**Deliverables**:
- AI chat accessible from navbar
- Context-aware responses based on course/module
- Chat history stored per module
- AI assistant helps with learning

---

### **Phase 6: Frontend UI Overhaul** (Week 6)
**Objective**: Redesign frontend for Moodle-like experience

#### Tasks:
- [ ] Navbar enhancements:
  - [ ] Add AI button (sparkles icon)
  - [ ] Add notifications bell with badge
  - [ ] Update user menu (profile, settings, logout)
  - [ ] Add course breadcrumb navigation

- [ ] Dashboard redesign:
  - [ ] Course cards with progress bars
  - [ ] Show enrolled courses only
  - [ ] Quick stats (courses completed, current progress)
  - [ ] "Continue Learning" section
  - [ ] Upcoming deadlines widget

- [ ] Course view enhancements:
  - [ ] Module list sidebar
  - [ ] Visual indicators:
    - [ ] Completed (checkmark)
    - [ ] In progress (partial progress bar)
    - [ ] Locked (lock icon + prerequisites)
    - [ ] Current module (highlight)
  - [ ] Progress bar showing course completion %

- [ ] Module view:
  - [ ] Rich content display
  - [ ] Video/image embedding
  - [ ] Quiz inline or as separate section
  - [ ] "Mark as complete" button
  - [ ] "Next module" button (enabled only if completed + quiz passed)
  - [ ] Module timer/duration display

- [ ] Styling:
  - [ ] Apply Moodle-like color scheme
  - [ ] Consistent spacing and typography
  - [ ] Responsive design for mobile
  - [ ] Dark mode support

**Deliverables**:
- Modern, intuitive UI
- Clear progress visualization
- Mobile-responsive design
- Professional appearance

---

### **Phase 7: CMS Admin Panel** (Week 7)
**Objective**: Build admin interface for content management without code changes

#### Tasks:
- [ ] Admin dashboard layout:
  - [x] Sidebar navigation
  - [x] Stats overview (total users, courses, completions)
  - [x] Quick actions menu

- [ ] Course management:
  - [ ] Create course form:
    - [x] Title, description, access code
    - [ ] Thumbnail upload
    - [x] Instructor assignment
  - [x] List courses with filters
  - [x] Edit course details
  - [ ] Delete course (with confirmation)
  - [ ] Archive/unpublish courses

- [ ] Module management:
  - [ ] Create module form:
    - [x] Title, order, content
    - [x] Video URL / image URL
    - [x] Duration input
    - [x] Prerequisite module selection
  - [ ] Drag-to-reorder modules
  - [x] Edit/delete modules
  - [ ] Preview module as student

- [ ] Quiz management:
  - [ ] Create quiz form:
    - [x] Select module
    - [x] Add questions (multiple choice)
    - [x] Set correct answers
    - [x] Set pass score
  - [ ] Edit/delete questions
  - [ ] Quiz preview

- [ ] User/enrollment management:
  - [ ] View all users with filters
  - [x] Manually enroll users in courses
  - [x] View enrollment status
  - [x] Remove users from courses
  - [x] Reset user progress (admin only)

- [ ] Analytics dashboard:
  - [x] Course completion rates
  - [x] Student progress summary
  - [x] Quiz performance summary
  - [ ] Time-on-platform statistics

#### Local implementation status (August 26, 2026)
The first local CMS slice is complete before Supabase integration. The current in-memory implementation includes:
- [x] Staff login and role-aware CMS access
- [x] Course create/edit and enrollment mode configuration
- [x] Instructor assignment field
- [x] Module create/edit with duration, media URLs, order, and prerequisites
- [x] Quiz creation/deletion with pass-score configuration
- [x] Student enrollment, enrollment removal, and progress reset controls
- [x] CMS section navigation for overview, courses, modules, quizzes, users, enrollments, and analytics
- [x] Basic course completion analytics and user/course/enrollment counters
- [x] New-course workflow that hands off directly to module setup
- [x] Local test administrator account documented in `LOCAL_TEST_ACCOUNTS.md`

Local test administrator: `admin@learnpedia.academy` / `admin123`. Select `Teacher / Admin` on `/login`.

#### CMS work deferred until a later slice
- [ ] Thumbnail and media file uploads
- [ ] Course archive, draft, publish, and visibility states
- [ ] Delete confirmation dialogs and dependency-aware deletion
- [ ] Drag-to-reorder modules
- [ ] Rich text editor and student preview mode
- [ ] Full quiz question editor with multiple questions, editing, and preview
- [ ] Enrollment history, filters, and per-course enrollment views
- [ ] Instructor-only course scoping and complete role management UI
- [ ] Detailed student progress and quiz-attempt reporting
- [ ] Time-on-platform analytics and chart visualizations

**Deliverables**:
- Fully functional admin panel
- Content can be added without code changes
- CMS-driven course management
- Analytics and reporting

---

### **Phase 8: Gamification & Achievements** (Week 8)
**Objective**: Add badges, points, and leaderboards to encourage engagement

#### Tasks:
- [ ] Achievement system:
  - [ ] Define achievement types:
    - [ ] First course completed
    - [ ] Quiz perfect score (100%)
    - [ ] 7-day learning streak
    - [ ] 30 days of consecutive engagement
    - [ ] All courses in track completed
  - [ ] Automatic achievement awarding
  - [ ] Badge design/icons

- [ ] Points system:
  - [ ] Award points for:
    - [ ] Module completion (+10 pts)
    - [ ] Quiz completion (+5 pts)
    - [ ] Perfect quiz score (+10 bonus pts)
    - [ ] Course completion (+50 pts)
  - [ ] Store total points per user
  - [ ] Display points on profile

- [ ] Leaderboard:
  - [ ] Global leaderboard (top 50 users by points)
  - [ ] Course-specific leaderboard
  - [ ] Time-based leaderboards (weekly, monthly)
  - [ ] User's rank display

- [ ] Frontend:
  - [ ] Display achievements on user profile
  - [ ] Achievement unlock notifications
  - [ ] Points display in navbar
  - [ ] Leaderboard page

**Deliverables**:
- Achievement system fully functional
- Points and gamification working
- Leaderboards displaying correctly
- Increased user engagement

---

### **Phase 9: Email Notifications & Reminders** (Week 9)
**Objective**: Add email-based notifications and learning reminders

#### Tasks:
- [ ] Email service setup:
  - [ ] Configure Sendgrid or equivalent
  - [ ] Create email templates (Handlebars/EJS)
  - [ ] Implement email queue (Bull + Redis)

- [ ] Email triggers:
  - [ ] Course enrollment confirmation
  - [ ] Module completion congratulations
  - [ ] Quiz passed/failed notifications
  - [ ] Achievement unlocked emails
  - [ ] Learning streak alerts
  - [ ] Weekly digest (summary of progress)

- [ ] User preferences:
  - [ ] Notification settings page
  - [ ] Enable/disable email types
  - [ ] Frequency preferences
  - [ ] Unsubscribe option

**Deliverables**:
- Email notifications working
- User preferences respected
- Professional email templates
- Configurable notification frequency

---

### **Phase 10: Testing, Optimization & Launch** (Week 10)
**Objective**: Ensure quality, performance, and deployment readiness

#### Tasks:
- [ ] Testing:
  - [ ] Unit tests for storage layer
  - [ ] Integration tests for API endpoints
  - [ ] E2E tests for critical user flows
  - [ ] Load testing for concurrent users
  - [ ] Security audit (OWASP top 10)

- [ ] Performance optimization:
  - [ ] Database query optimization (indexes, explain plans)
  - [ ] Implement caching (Redis)
  - [ ] Code splitting for frontend bundles
  - [ ] Image optimization (CDN, compression)
  - [ ] API response time monitoring

- [ ] Documentation:
  - [ ] API documentation (Swagger/OpenAPI)
  - [ ] User guide for students
  - [ ] Admin guide for instructors/admins
  - [ ] Developer setup guide
  - [ ] Deployment guide

- [ ] Deployment:
  - [ ] Set up CI/CD pipeline (GitHub Actions)
  - [ ] Configure staging environment
  - [ ] Database migration scripts
  - [ ] Rollback procedures
  - [ ] Production deployment

**Deliverables**:
- Comprehensive test coverage
- Production-ready performance
- Complete documentation
- Successful production launch

---

## 🎯 Success Metrics

By the end of this roadmap, the AT-School LMS will have:

| Metric | Target |
|--------|--------|
| **Test Coverage** | >80% code coverage |
| **API Response Time** | <200ms (p95) |
| **User Load Capacity** | 1000+ concurrent users |
| **Module Load Time** | <1s |
| **Uptime** | 99.9% |
| **User Satisfaction** | >4.5/5 stars |
| **Course Completion Rate** | >70% |

---

## 🛠 Tools & Dependencies

### New Dependencies to Add:
```json
{
  "@supabase/supabase-js": "^2.x",
  "@supabase/ssr": "^0.x",
  "socket.io": "^4.x",
  "openai": "^4.x",
  "nodemailer": "^6.x",
  "bull": "^4.x",
  "redis": "^4.x",
  "bcryptjs": "^2.x"
}
```

### Development Tools:
```json
{
  "jest": "^29.x",
  "supertest": "^6.x",
  "cypress": "^13.x",
  "swagger-ui-express": "^5.x"
}
```

---

## 📌 Key Milestones

- **Week 1-2**: Authentication & Database ✓ Foundation
- **Week 3**: Access Control ✓ Security
- **Week 4-5**: Notifications & AI ✓ Core Features
- **Week 6-7**: UI & CMS ✓ User Experience
- **Week 8-9**: Gamification & Emails ✓ Engagement
- **Week 10**: Testing & Launch ✓ Production Ready

---

## ⚠️ Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Supabase integration complexity | High | Start with simple auth, expand gradually |
| Database migration downtime | High | Use zero-downtime migrations, test in staging |
| Performance degradation with new features | Medium | Profile early, optimize queries incrementally |
| AI API costs | Medium | Implement rate limiting, monitor usage |
| User adoption friction | Medium | Onboarding guide, intuitive UI, feedback loops |

---

## 📞 Support & Communication

- **Status Updates**: Weekly sprint reviews
- **Issue Tracking**: GitHub Issues with `roadmap` label
- **Documentation**: Wiki and inline code comments
- **Team Standups**: Daily 15-minute sync (optional)

---

**Last Updated**: August 22, 2026  
**Next Review**: After Phase 1 completion

