import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { getSubscriptionExpiryDate, isPaymentPlanId, isSubscriptionActive, PAYMENT_PLANS, type PaymentPlanId } from "../shared/payment-plans.js";
import { storage } from "./storage.js";
import {
  insertUserSchema,
  insertCourseSchema,
  insertModuleSchema,
  insertQuizSchema,
  loginSchema,
  unlockCourseSchema,
  insertModuleCompletionSchema,
  insertQuizAttemptSchema,
  insertProjectSchema,
  cbtExamTypeSchema,
  cbtQuestionInputSchema,
  quizQuestionImageUrlSchema,
  type CbtAttempt,
  type CbtExamType,
  type CbtAttemptSelection,
  type CbtQuestion,
  type EventInput,
  type Module,
  type QuizQuestion,
} from "../shared/schema.js";
import { z } from "zod";
import { createSupabaseAdminClient, createSupabaseAuthClient } from "./supabase-admin.js";
import { compareModuleOrder, isModuleWithinFreeTopLevelTier } from "../shared/module-utils.js";
import { normalizeQuizQuestionIndex } from "../shared/quiz-utils.js";
import { isValidTimeZone } from "../shared/event-utils.js";
import { canAccessCourseConversation, canStartCourseConversation, isMessagingStaffRole } from "./messaging-utils.js";
import {
  cbtAttemptRequestSchema,
  scoreCbtAttempt,
  sampleCbtQuestionsAcrossTopics,
  shuffleCbtQuestions,
  toCbtAttemptHistoryEntry,
  toCbtStudentAttempt,
} from "./cbt-utils.js";

const quizQuestionInputSchema = z.object({
  id: z.string(),
  question: z.string().min(1),
  questionImageUrl: quizQuestionImageUrlSchema.optional(),
  explanation: z.string().optional(),
  explanationImageUrl: quizQuestionImageUrlSchema.optional(),
  options: z.array(z.string().min(1)).length(4),
  correctAnswer: z.number().int().min(1).max(4),
  correctAnswerBase: z.literal(1),
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      const data = insertUserSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(data.email);
      if (existingUser) {
        return res.status(400).json({ error: "Email already registered" });
      }

      const user = await storage.createUser(data);
      
      // Don't send password back
      const { password, ...userWithoutPassword } = user;
      
      res.json({ user: userWithoutPassword });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Registration failed" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const data = loginSchema.parse(req.body);
      
      const user = await storage.getUserByEmail(data.email);
      if (!user || user.password !== data.password) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      const { password, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.patch("/api/users/:id", async (req, res) => {
    try {
      const data = z.object({ fullName: z.string().min(2), email: z.string().email() }).parse(req.body);
      const user = await storage.updateUser(req.params.id, data);
      if (!user) return res.status(404).json({ error: "User not found" });
      const { password, ...safeUser } = user;
      res.json({ user: safeUser });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  const requireAdmin = async (userId: unknown, res: any) => {
    const user = typeof userId === "string" ? await storage.getUser(userId) : undefined;
    if (!user || !["admin", "super_admin", "superadmin", "instructor"].includes(user.role)) {
      res.status(403).json({ error: "Admin or instructor access required" });
      return undefined;
    }
    return user;
  };

  const requireAuthenticatedStaff = async (req: Request, res: Response) => {
    const authorization = req.header("Authorization");
    const accessToken = authorization?.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length)
      : undefined;
    if (!accessToken) {
      res.status(401).json({ error: "Supabase access token required" });
      return undefined;
    }

    const { data, error } = await createSupabaseAuthClient().auth.getUser(accessToken);
    if (error || !data.user) {
      res.status(401).json({ error: "Invalid Supabase session" });
      return undefined;
    }

    const requester = await storage.getUser(data.user.id);
    if (!requester || !["admin", "super_admin", "superadmin", "instructor"].includes(requester.role)) {
      res.status(403).json({ error: "Instructor or administrator access required" });
      return undefined;
    }

    return requester;
  };

  const requireAuthenticatedStudent = async (req: Request, res: Response) => {
    const authorization = req.header("Authorization");
    const accessToken = authorization?.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length)
      : undefined;
    if (!accessToken) {
      res.status(401).json({ error: "Supabase access token required" });
      return undefined;
    }

    const { data, error } = await createSupabaseAuthClient().auth.getUser(accessToken);
    if (error || !data.user) {
      res.status(401).json({ error: "Invalid Supabase session" });
      return undefined;
    }

    const requester = await storage.getUser(data.user.id);
    if (!requester || requester.role !== "student") {
      res.status(403).json({ error: "Student access required" });
      return undefined;
    }

    return requester;
  };

  const requireAuthenticatedMessagingUser = async (req: Request, res: Response) => {
    const authorization = req.header("Authorization");
    const accessToken = authorization?.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length)
      : undefined;
    if (!accessToken) {
      res.status(401).json({ error: "Supabase access token required" });
      return undefined;
    }

    const { data, error } = await createSupabaseAuthClient().auth.getUser(accessToken);
    if (error || !data.user) {
      res.status(401).json({ error: "Invalid Supabase session" });
      return undefined;
    }

    const requester = await storage.getUser(data.user.id);
    if (!requester || (requester.role !== "student" && !isMessagingStaffRole(requester.role))) {
      res.status(403).json({ error: "Messaging access required" });
      return undefined;
    }
    return requester;
  };

  const finalizeCbtAttempt = async (attempt: CbtAttempt, forceExpired = false) => {
    if (attempt.status !== "in_progress") return attempt;
    const expired = forceExpired || attempt.expiresAt.getTime() <= Date.now();
    const finished = await storage.finishCbtAttempt(attempt.id, {
      status: expired ? "expired" : "submitted",
      score: scoreCbtAttempt(attempt.questions, attempt.answers),
      submittedAt: new Date(),
    });
    return finished ?? await storage.getCbtAttempt(attempt.id) ?? attempt;
  };

  const isSuperAdmin = (role?: string | null) => ["admin", "super_admin", "superadmin"].includes(role || "");
  const canReviewManualPayments = (role?: string | null) => role === "super_admin";

  const canAccessModule = async (userId: string, module: Module) => {
    const courseModules = await storage.getModulesByCourse(module.courseId);
    const orderedModules = courseModules.sort((a, b) => compareModuleOrder(a, b, courseModules));
    const moduleIndex = orderedModules.findIndex((item) => item.id === module.id);
    if (moduleIndex < 0) return false;
    if (!isModuleWithinFreeTopLevelTier(module, orderedModules)) {
      const user = await storage.getUser(userId);
      const isStaff = user && ["admin", "super_admin", "superadmin", "instructor"].includes(user.role);
      if (!isStaff && !user?.hasActiveSubscription) return false;
    }

    const requirements = new Map<string, Module>(
      orderedModules.slice(0, moduleIndex).map((previousModule) => [previousModule.id, previousModule]),
    );
    if (module.prerequisiteModuleId) {
      const prerequisite = orderedModules.find((item) => item.id === module.prerequisiteModuleId)
        ?? await storage.getModule(module.prerequisiteModuleId);
      if (!prerequisite) return false;
      requirements.set(prerequisite.id, prerequisite);
    }

    const passedQuizModuleIds = await storage.getPassedQuizModuleIds(userId, module.courseId);
    for (const requirement of Array.from(requirements.values())) {
      const hasQuiz = !!(await storage.getQuizByModule(requirement.id));
      if (hasQuiz && !passedQuizModuleIds.has(requirement.id)) return false;
    }

    return true;
  };

  const generateTemporaryPassword = () => `Learnpedia-${randomBytes(4).toString("hex")}!`;

  // Course routes
  app.get("/api/courses", async (req, res) => {
    try {
      const courses = await storage.getAllCourses();
      res.json(courses);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch courses" });
    }
  });

  app.get("/api/courses/:id", async (req, res) => {
    try {
      const course = await storage.getCourse(req.params.id);
      if (!course) {
        return res.status(404).json({ error: "Course not found" });
      }
      res.json(course);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch course" });
    }
  });

  app.post("/api/courses/:courseId/enroll", async (req, res) => {
    try {
      const student = await requireAuthenticatedStudent(req, res);
      if (!student) return;
      const courseId = z.string().uuid().parse(req.params.courseId);
      const course = await storage.getCourse(courseId);
      if (!course || !course.isPublished) return res.status(404).json({ error: "Course not found" });
      if (course.enrollmentMode !== "self") {
        return res.status(403).json({ error: "This course requires enrollment by its instructor." });
      }

      const enrollment = await storage.enrollStudent(student.id, course.id);
      res.status(200).json(enrollment);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      console.error("Failed to enroll student in course:", error);
      res.status(500).json({ error: "Failed to enroll in course" });
    }
  });

  // User course routes (unlocking)
  app.get("/api/user-courses/:userId", async (req, res) => {
    try {
      const requester = await requireAuthenticatedMessagingUser(req, res);
      if (!requester) return;
      if (requester.id !== req.params.userId) return res.status(403).json({ error: "You can only view your own course access." });
      const userCourses = await storage.getUserCourses(req.params.userId);
      res.json(userCourses);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user courses" });
    }
  });

  app.post("/api/user-courses/unlock", async (_req, res) => {
    res.status(400).json({
      error: "Access codes are no longer used. Subscribers have full access, and the free tier includes modules 1 and 2 only.",
    });
  });

  app.get("/api/admin/courses", async (req, res) => {
    const requester = await requireAdmin(req.query.userId, res);
    if (!requester) return;
    const allCourses = await storage.getAllCourses();
    if (isSuperAdmin(requester.role)) {
      return res.json(allCourses);
    }
    res.json(allCourses.filter((course) => course.instructorId === requester.id));
  });

  app.post("/api/admin/courses", async (req, res) => {
    const requester = await requireAuthenticatedStaff(req, res);
    if (!requester) return;
    try {
      const data = insertCourseSchema.parse({ ...req.body.course, accessCode: req.body.course?.accessCode || "" });
      const instructorId = isSuperAdmin(requester.role) ? (data.instructorId || requester.id) : requester.id;
      const instructor = await storage.getUser(instructorId);
      if (!instructor || !["admin", "super_admin", "superadmin", "instructor"].includes(instructor.role)) {
        return res.status(400).json({ error: "The assigned account must be an instructor or admin" });
      }
      const course = await storage.createCourse({
        ...data,
        instructorId,
        isPublished: false,
        publishedAt: null,
      });
      res.json(course);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      res.status(500).json({ error: "Failed to create course" });
    }
  });

  app.patch("/api/admin/courses/:id", async (req, res) => {
    const requester = await requireAdmin(req.body.userId, res);
    if (!requester) return;
    const courseBefore = await storage.getCourse(req.params.id);
    if (!courseBefore) return res.status(404).json({ error: "Course not found" });
    if (!isSuperAdmin(requester.role) && courseBefore.instructorId !== requester.id) {
      return res.status(403).json({ error: "You can only edit courses assigned to you" });
    }
    const nextCourseData = req.body.course || {};
    if (!isSuperAdmin(requester.role)) {
      if (nextCourseData.instructorId && nextCourseData.instructorId !== requester.id) {
        return res.status(403).json({ error: "Only an admin can reassign a course" });
      }
      nextCourseData.instructorId = requester.id;
    }
    if (nextCourseData.instructorId) {
      const instructor = await storage.getUser(nextCourseData.instructorId);
      if (!instructor || !["admin", "super_admin", "superadmin", "instructor"].includes(instructor.role)) {
        return res.status(400).json({ error: "The assigned account must be an instructor or admin" });
      }
    }
    const course = await storage.updateCourse(req.params.id, {
      ...nextCourseData,
      accessCode: nextCourseData.accessCode || "",
      publishedAt: nextCourseData.isPublished === true && !courseBefore.isPublished ? new Date() : nextCourseData.isPublished === false ? null : courseBefore.publishedAt,
    });
    if (!course) return res.status(404).json({ error: "Course not found" });
    res.json(course);
  });

  app.patch("/api/admin/users/:id/role", async (req, res) => {
    const requester = await requireAdmin(req.body.adminId, res);
    if (!requester) return;
    if (!isSuperAdmin(requester.role)) {
      return res.status(403).json({ error: "Only an admin can change user roles" });
    }
    const role = z.enum(["student", "instructor", "admin"]).parse(req.body.role);
    const user = await storage.updateUser(req.params.id, { role });
    if (!user) return res.status(404).json({ error: "User not found" });
    const { password, ...safeUser } = user;
    res.json({ user: safeUser });
  });

  app.delete("/api/admin/courses/:id", async (req, res) => {
    const requester = await requireAdmin(req.query.userId, res);
    if (!requester) return;

    const course = await storage.getCourse(req.params.id);
    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }

    const canDelete = isSuperAdmin(requester.role) || (!course.isPublished && course.instructorId === requester.id);
    if (!canDelete) {
      return res.status(403).json({ error: "Only a super admin can delete a published course. Unpublished courses can be removed by their creator." });
    }

    res.json({ deleted: await storage.deleteCourse(req.params.id) });
  });

  app.get("/api/admin/users", async (req, res) => {
    if (!(await requireAdmin(req.query.userId, res))) return;
    res.json((await storage.getAllUsers()).map(({ password, ...user }) => user));
  });

  app.get("/api/announcements", async (_req, res) => {
    try {
      const { data, error } = await createSupabaseAdminClient()
        .from("announcements")
        .select("id, title, message, created_at, profiles(full_name)")
        .order("created_at", { ascending: false });
      if (error) return res.status(500).json({ error: error.message });
      res.json((data ?? []).map((announcement: any) => ({
        id: announcement.id,
        title: announcement.title,
        message: announcement.message,
        createdAt: announcement.created_at,
        authorName: announcement.profiles?.full_name || "System",
      })));
    } catch {
      res.status(500).json({ error: "Failed to fetch announcements" });
    }
  });

  app.post("/api/announcements", async (req, res) => {
    try {
      const authorization = req.header("Authorization");
      const accessToken = authorization?.startsWith("Bearer ") ? authorization.slice(7) : undefined;
      if (!accessToken) return res.status(401).json({ error: "Supabase access token required" });
      const authClient = createSupabaseAuthClient();
      const { data: authData, error: authError } = await authClient.auth.getUser(accessToken);
      if (authError || !authData.user) return res.status(401).json({ error: "Invalid Supabase session" });
      const adminClient = createSupabaseAdminClient();
      const { data: profile } = await adminClient.from("profiles").select("id, full_name, role").eq("id", authData.user.id).single();
      if (!profile || !["admin", "super_admin", "instructor"].includes(profile.role)) {
        return res.status(403).json({ error: "Staff access required" });
      }
      const input = z.object({ title: z.string().trim().min(1), message: z.string().trim().min(1) }).parse(req.body);
      const { data, error } = await adminClient.from("announcements").insert({ title: input.title, message: input.message, author_id: profile.id }).select("id, title, message, created_at").single();
      if (error) return res.status(500).json({ error: error.message });
      res.status(201).json({ ...data, createdAt: data.created_at, authorName: profile.full_name });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      res.status(500).json({ error: "Failed to create announcement" });
    }
  });

  const eventInputSchema = z.object({
    title: z.string().trim().min(1).max(160),
    description: z.string().trim().min(1).max(10000),
    startsAt: z.string().datetime({ offset: true }).transform((value) => new Date(value)),
    endsAt: z.string().datetime({ offset: true }).transform((value) => new Date(value)),
    timezone: z.string().trim().min(1).max(100),
    location: z.string().trim().max(200).optional().default(""),
    meetingUrl: z.union([z.literal(""), z.string().url().max(500)]).optional().default(""),
  }).superRefine((input, context) => {
    if (input.endsAt <= input.startsAt) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endsAt"],
        message: "Event end time must be after its start time.",
      });
    }
    if (!isValidTimeZone(input.timezone)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["timezone"],
        message: "Choose a valid IANA timezone.",
      });
    }
    if (input.meetingUrl && new URL(input.meetingUrl).protocol !== "https:") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["meetingUrl"],
        message: "Meeting links must use HTTPS.",
      });
    }
  });

  const getEventForStaffOrRespond = async (
    id: string,
    requester: { id: string; role: string },
    res: Response,
  ) => {
    const event = await storage.getEvent(id);
    if (!event) {
      res.status(404).json({ error: "Event not found" });
      return undefined;
    }
    if (!isSuperAdmin(requester.role) && event.authorId !== requester.id) {
      res.status(403).json({ error: "You can only manage events you created." });
      return undefined;
    }
    return event;
  };

  app.get("/api/admin/events", async (req, res) => {
    try {
      const requester = await requireAuthenticatedStaff(req, res);
      if (!requester) return;
      const events = await storage.getEventsForStaff(
        isSuperAdmin(requester.role) ? {} : { authorId: requester.id },
      );
      res.json(events);
    } catch (error) {
      console.error("Failed to fetch staff events:", error);
      res.status(500).json({ error: "Failed to fetch events" });
    }
  });

  app.post("/api/admin/events", async (req, res) => {
    try {
      const requester = await requireAuthenticatedStaff(req, res);
      if (!requester) return;
      const input: EventInput = eventInputSchema.parse(req.body);
      res.status(201).json(await storage.createEvent(input, requester.id));
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      console.error("Failed to create event:", error);
      res.status(500).json({ error: "Failed to create event" });
    }
  });

  app.patch("/api/admin/events/:id", async (req, res) => {
    try {
      const requester = await requireAuthenticatedStaff(req, res);
      if (!requester) return;
      const id = z.string().uuid().parse(req.params.id);
      const event = await getEventForStaffOrRespond(id, requester, res);
      if (!event) return;
      if (event.status === "cancelled") return res.status(409).json({ error: "Cancelled events cannot be edited." });
      const input: EventInput = eventInputSchema.parse(req.body);
      const changed = input.title !== event.title
        || input.description !== event.description
        || input.startsAt.getTime() !== event.startsAt.getTime()
        || input.endsAt.getTime() !== event.endsAt.getTime()
        || input.timezone !== event.timezone
        || (input.location || "") !== (event.location || "")
        || (input.meetingUrl || "") !== (event.meetingUrl || "");
      if (!changed) return res.json(event);

      const updated = await storage.updateEvent(id, {
        ...input,
        ...(event.status === "published" ? { revision: event.revision + 1 } : {}),
      });
      if (!updated) return res.status(404).json({ error: "Event not found" });
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      console.error("Failed to update event:", error);
      res.status(500).json({ error: "Failed to update event" });
    }
  });

  app.post("/api/admin/events/:id/publish", async (req, res) => {
    try {
      const requester = await requireAuthenticatedStaff(req, res);
      if (!requester) return;
      const id = z.string().uuid().parse(req.params.id);
      const event = await getEventForStaffOrRespond(id, requester, res);
      if (!event) return;
      if (event.status !== "draft") return res.status(409).json({ error: "Only draft events can be published." });
      const updated = await storage.updateEvent(id, {
        status: "published",
        revision: event.revision + 1,
        publishedAt: new Date(),
      });
      if (!updated) return res.status(404).json({ error: "Event not found" });
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      console.error("Failed to publish event:", error);
      res.status(500).json({ error: "Failed to publish event" });
    }
  });

  app.post("/api/admin/events/:id/cancel", async (req, res) => {
    try {
      const requester = await requireAuthenticatedStaff(req, res);
      if (!requester) return;
      const id = z.string().uuid().parse(req.params.id);
      const event = await getEventForStaffOrRespond(id, requester, res);
      if (!event) return;
      if (event.status !== "published") return res.status(409).json({ error: "Only published events can be cancelled." });
      const updated = await storage.updateEvent(id, {
        status: "cancelled",
        revision: event.revision + 1,
      });
      if (!updated) return res.status(404).json({ error: "Event not found" });
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      console.error("Failed to cancel event:", error);
      res.status(500).json({ error: "Failed to cancel event" });
    }
  });

  app.delete("/api/admin/events/:id", async (req, res) => {
    try {
      const requester = await requireAuthenticatedStaff(req, res);
      if (!requester) return;
      const id = z.string().uuid().parse(req.params.id);
      const event = await getEventForStaffOrRespond(id, requester, res);
      if (!event) return;
      if (event.status !== "draft") return res.status(409).json({ error: "Only draft events can be deleted." });
      res.json({ deleted: await storage.deleteEvent(id) });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      console.error("Failed to delete event:", error);
      res.status(500).json({ error: "Failed to delete event" });
    }
  });

  app.get("/api/messages", async (req, res) => {
    try {
      const requester = await requireAuthenticatedMessagingUser(req, res);
      if (!requester) return;
      const conversations = await storage.getCourseConversationsForUser(requester.id);
      const accessible = await Promise.all(conversations.map(async (conversation) => {
        const course = await storage.getCourse(conversation.courseId);
        return course && canAccessCourseConversation(requester, conversation, course) ? conversation : null;
      }));
      res.json(accessible.filter((conversation) => conversation !== null));
    } catch (error) {
      console.error("Failed to fetch course conversations:", error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  app.get("/api/messages/courses", async (req, res) => {
    try {
      const student = await requireAuthenticatedStudent(req, res);
      if (!student) return;

      const courses = await storage.getAllCourses();
      const directory = await Promise.all(courses
        .filter((course) => canStartCourseConversation(student, course))
        .map(async (course) => {
          const instructor = course.instructorId
            ? await storage.getUser(course.instructorId)
            : undefined;
          if (!instructor || !isMessagingStaffRole(instructor.role)) return null;

          return {
            id: course.id,
            title: course.title,
            instructorName: instructor.fullName,
          };
        }));

      res.json(directory.filter((course) => course !== null));
    } catch (error) {
      console.error("Failed to fetch messageable courses:", error);
      res.status(500).json({ error: "Failed to fetch courses for messaging" });
    }
  });

  app.post("/api/messages/course/:courseId", async (req, res) => {
    try {
      const student = await requireAuthenticatedStudent(req, res);
      if (!student) return;
      const courseId = z.string().uuid().parse(req.params.courseId);
      const course = await storage.getCourse(courseId);
      if (!course || !canStartCourseConversation(student, course)) {
        return res.status(404).json({ error: "Course messaging is unavailable" });
      }
      res.json(await storage.getOrCreateCourseConversation(course, student.id));
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      console.error("Failed to open course conversation:", error);
      res.status(500).json({ error: "Failed to open course conversation" });
    }
  });

  app.get("/api/messages/:id", async (req, res) => {
    try {
      const requester = await requireAuthenticatedMessagingUser(req, res);
      if (!requester) return;
      const id = z.string().uuid().parse(req.params.id);
      const conversation = await storage.getCourseConversation(id, requester.id);
      if (!conversation) return res.status(404).json({ error: "Conversation not found" });
      const course = await storage.getCourse(conversation.courseId);
      if (!course || !canAccessCourseConversation(requester, conversation, course)) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      await storage.markCourseMessagesRead(id, requester.id);
      const [updatedConversation, messages] = await Promise.all([
        storage.getCourseConversation(id, requester.id),
        storage.getCourseMessages(id, 100),
      ]);
      res.json({ conversation: updatedConversation, messages });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      console.error("Failed to fetch course messages:", error);
      res.status(500).json({ error: "Failed to fetch conversation" });
    }
  });

  app.post("/api/messages/:id", async (req, res) => {
    try {
      const requester = await requireAuthenticatedMessagingUser(req, res);
      if (!requester) return;
      const id = z.string().uuid().parse(req.params.id);
      const { body } = z.object({ body: z.string().trim().min(1).max(4000) }).parse(req.body);
      const conversation = await storage.getCourseConversation(id, requester.id);
      if (!conversation) return res.status(404).json({ error: "Conversation not found" });
      const course = await storage.getCourse(conversation.courseId);
      if (!course || !canAccessCourseConversation(requester, conversation, course)) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      res.status(201).json(await storage.createCourseMessage(id, requester.id, body));
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      console.error("Failed to send course message:", error);
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  app.get("/api/events", async (req, res) => {
    try {
      const student = await requireAuthenticatedStudent(req, res);
      if (!student) return;
      res.json(await storage.getEventsForStudent(student.id));
    } catch (error) {
      console.error("Failed to fetch student events:", error);
      res.status(500).json({ error: "Failed to fetch events" });
    }
  });

  app.post("/api/events/:id/rsvp", async (req, res) => {
    try {
      const student = await requireAuthenticatedStudent(req, res);
      if (!student) return;
      const id = z.string().uuid().parse(req.params.id);
      const { status } = z.object({
        status: z.enum(["attending", "not_attending"]),
      }).parse(req.body);
      const event = await storage.getEvent(id, student.id);
      if (!event || (event.status !== "published" && event.status !== "cancelled")) {
        return res.status(404).json({ error: "Event not found" });
      }
      if (event.status !== "published") return res.status(409).json({ error: "This event has been cancelled." });
      if (event.startsAt.getTime() <= Date.now()) return res.status(409).json({ error: "RSVP is closed after an event starts." });
      res.json(await storage.setEventRsvp(id, student.id, status));
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      console.error("Failed to update event RSVP:", error);
      res.status(500).json({ error: "Failed to update RSVP" });
    }
  });

  app.get("/api/events/notifications", async (req, res) => {
    try {
      const student = await requireAuthenticatedStudent(req, res);
      if (!student) return;
      res.json(await storage.getEventNotifications(student.id));
    } catch (error) {
      console.error("Failed to fetch event notifications:", error);
      res.status(500).json({ error: "Failed to fetch event notifications" });
    }
  });

  app.post("/api/events/notifications/:id/read", async (req, res) => {
    try {
      const student = await requireAuthenticatedStudent(req, res);
      if (!student) return;
      const id = z.string().uuid().parse(req.params.id);
      const updated = await storage.markEventNotificationRead(id, student.id);
      if (!updated) return res.status(404).json({ error: "Notification not found or already read." });
      res.json({ read: true });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      console.error("Failed to mark event notification read:", error);
      res.status(500).json({ error: "Failed to update notification" });
    }
  });

  const getPaystackConfig = () => {
    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    const isProduction = process.env.NODE_ENV === "production";
    const vercelHostname = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
    const callbackUrl = process.env.PAYSTACK_CALLBACK_URL
      || (isProduction && vercelHostname ? `https://${vercelHostname}/profile` : undefined)
      || (isProduction ? "" : "http://localhost:5000/profile");
    if (!secretKey || secretKey.includes("replace_with")) {
      throw new Error("Paystack server configuration is missing");
    }
    let parsedCallbackUrl: URL;
    try {
      parsedCallbackUrl = new URL(callbackUrl);
    } catch {
      throw new Error("PAYSTACK_CALLBACK_URL must be a valid URL");
    }
    if (isProduction && parsedCallbackUrl.protocol !== "https:") {
      throw new Error("PAYSTACK_CALLBACK_URL must be an HTTPS URL in production; configure it or deploy with a Vercel hostname");
    }
    return { secretKey, callbackUrl };
  };

  const verifyAccessToken = async (req: any) => {
    const authorization = req.header("Authorization");
    const accessToken = authorization?.startsWith("Bearer ") ? authorization.slice(7) : undefined;
    if (!accessToken) return undefined;
    const { data, error } = await createSupabaseAuthClient().auth.getUser(accessToken);
    if (error || !data.user) return undefined;
    return data.user;
  };

  const updateSubscriptionAccess = async (
    userId: string,
    active: boolean,
    reference: string,
    plan: PaymentPlanId | "one-time" = "one-time",
    completedAt?: Date,
  ) => {
    const client = createSupabaseAdminClient();
    const paidAt = active ? completedAt ?? new Date() : null;
    const { error: profileError } = await client.from("profiles").update({
      has_active_subscription: active,
      subscription_tier: active ? plan : "none",
      subscription_paid_at: paidAt?.toISOString() ?? null,
      subscription_expires_at: active && paidAt && plan !== "one-time"
        ? getSubscriptionExpiryDate(plan, paidAt).toISOString()
        : null,
    }).eq("id", userId);
    if (profileError) throw new Error(profileError.message);

    if (active) {
      const [{ data: courses, error: coursesError }, { data: currentAccess, error: accessError }] = await Promise.all([
        client.from("courses").select("id").eq("is_published", true),
        client.from("user_courses").select("course_id, access_source").eq("user_id", userId),
      ]);
      if (coursesError || accessError) throw new Error(coursesError?.message || accessError?.message);
      const existing = new Set((currentAccess ?? []).map((item) => item.course_id));
      const missing = (courses ?? []).filter((course) => !existing.has(course.id));
      if (missing.length) {
        const { error } = await client.from("user_courses").upsert(missing.map((course) => ({
          user_id: userId,
          course_id: course.id,
          access_source: "subscription",
        })), { onConflict: "user_id,course_id", ignoreDuplicates: true });
        if (error) throw new Error(error.message);
      }
    } else {
      const { error } = await client.from("user_courses").delete().eq("user_id", userId).eq("access_source", "subscription");
      if (error) throw new Error(error.message);
    }

    console.log(`Paystack subscription ${active ? "activated" : "revoked"} for ${userId} (${reference})`);
  };

  app.post("/api/payments/paystack/initialize", async (req, res) => {
    try {
      const user = await verifyAccessToken(req);
      if (!user) return res.status(401).json({ error: "Valid Supabase session required" });
      const { plan } = z.object({ plan: z.enum(["monthly", "yearly"]) }).parse({
        plan: req.body?.plan ?? req.query.plan,
      });
      const { secretKey, callbackUrl } = getPaystackConfig();
      const amount = PAYMENT_PLANS[plan].amount * 100;
      const adminClient = createSupabaseAdminClient();
      const { data: profile, error: profileError } = await adminClient.from("profiles").select("has_active_subscription, subscription_expires_at").eq("id", user.id).single();
      if (profileError || !profile) return res.status(500).json({ error: "Unable to verify subscription status" });
      if (isSubscriptionActive(profile.has_active_subscription, profile.subscription_expires_at)) {
        return res.status(409).json({ error: "Your subscription is already active" });
      }
      const { data: pendingTransfer, error: pendingTransferError } = await adminClient
        .from("manual_payment_submissions")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "pending")
        .maybeSingle();
      if (pendingTransferError) return res.status(500).json({ error: "Unable to check pending bank transfers" });
      if (pendingTransfer) return res.status(409).json({ error: "A bank transfer is awaiting administrator review" });
      const reference = `learnpedia_${randomBytes(12).toString("hex")}`;
      const paystackResponse = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email, amount, currency: "NGN", reference, callback_url: callbackUrl }),
      });
      const result = await paystackResponse.json() as { status?: boolean; message?: string; data?: { authorization_url: string; access_code: string; reference: string } };
      if (!paystackResponse.ok || !result.status || !result.data) return res.status(502).json({ error: result.message || "Paystack initialization failed" });

      const { error } = await adminClient.from("payments").insert({
        user_id: user.id,
        provider: "paystack",
        provider_ref: result.data.reference,
        amount: amount / 100,
        currency: "NGN",
        status: "pending",
        metadata: { access_code: result.data.access_code, plan },
      });
      if (error) return res.status(500).json({ error: error.message });
      res.json({ authorizationUrl: result.data.authorization_url, reference: result.data.reference });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      if (error instanceof Error && (error.message.includes("Paystack") || error.message.includes("PAYSTACK"))) return res.status(503).json({ error: error.message });
      res.status(500).json({ error: "Unable to initialize payment" });
    }
  });

  app.get("/api/payments/manual-transfer", async (req, res) => {
    try {
      const user = await verifyAccessToken(req);
      if (!user) return res.status(401).json({ error: "Valid Supabase session required" });
      const client = createSupabaseAdminClient();
      const { data, error } = await client
        .from("manual_payment_submissions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) return res.status(500).json({ error: "Unable to fetch transfer submissions" });
      res.json(data ?? []);
    } catch {
      res.status(500).json({ error: "Unable to fetch transfer submissions" });
    }
  });

  app.post("/api/payments/manual-transfer", async (req, res) => {
    try {
      const user = await verifyAccessToken(req);
      if (!user) return res.status(401).json({ error: "Valid Supabase session required" });
      const { plan, bankName, bankReference } = z.object({
        plan: z.enum(["monthly", "yearly"]),
        bankName: z.enum(["Sterling Bank", "OPay"]),
        bankReference: z.string().trim().min(4).max(120),
      }).parse(req.body);

      const client = createSupabaseAdminClient();
      const { data: profile, error: profileError } = await client
        .from("profiles")
        .select("has_active_subscription, subscription_expires_at")
        .eq("id", user.id)
        .single();
      if (profileError || !profile) return res.status(500).json({ error: "Unable to verify subscription status" });
      if (isSubscriptionActive(profile.has_active_subscription, profile.subscription_expires_at)) {
        return res.status(409).json({ error: "Your subscription is already active" });
      }

      const { data: pendingSubmission, error: pendingError } = await client
        .from("manual_payment_submissions")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "pending")
        .maybeSingle();
      if (pendingError) return res.status(500).json({ error: "Unable to check pending transfers" });
      if (pendingSubmission) return res.status(409).json({ error: "You already have a transfer awaiting review" });

      const { data, error } = await client
        .from("manual_payment_submissions")
        .insert({
          user_id: user.id,
          plan,
          amount: PAYMENT_PLANS[plan].amount,
          currency: "NGN",
          bank_name: bankName,
          bank_reference: bankReference,
        })
        .select("*")
        .single();
      if (error) {
        if (error.code === "23505") return res.status(409).json({ error: "This transaction reference has already been submitted, or a transfer is already awaiting review" });
        return res.status(500).json({ error: "Unable to submit transfer for review" });
      }
      res.status(201).json(data);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      res.status(500).json({ error: "Unable to submit transfer for review" });
    }
  });

  app.get("/api/admin/manual-payments", async (req, res) => {
    try {
      const reviewer = await requireAuthenticatedStaff(req, res);
      if (!reviewer) return;
      if (!canReviewManualPayments(reviewer.role)) return res.status(403).json({ error: "Super administrator access required" });

      const client = createSupabaseAdminClient();
      const { data: submissions, error } = await client
        .from("manual_payment_submissions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) return res.status(500).json({ error: "Unable to fetch manual payment submissions" });

      const userIds = Array.from(new Set((submissions ?? []).map((submission) => submission.user_id)));
      const { data: profiles, error: profilesError } = userIds.length
        ? await client.from("profiles").select("id, full_name, email").in("id", userIds)
        : { data: [], error: null };
      if (profilesError) return res.status(500).json({ error: "Unable to fetch payment account details" });
      const profilesById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
      res.json((submissions ?? []).map((submission) => ({
        ...submission,
        user: profilesById.get(submission.user_id) ?? null,
      })));
    } catch {
      res.status(500).json({ error: "Unable to fetch manual payment submissions" });
    }
  });

  app.post("/api/admin/manual-payments/:id/review", async (req, res) => {
    try {
      const reviewer = await requireAuthenticatedStaff(req, res);
      if (!reviewer) return;
      if (!canReviewManualPayments(reviewer.role)) return res.status(403).json({ error: "Super administrator access required" });

      const { decision, reviewNote } = z.object({
        decision: z.enum(["approved", "rejected"]),
        reviewNote: z.string().trim().max(500).optional(),
      }).parse(req.body);
      const submissionId = z.string().uuid().parse(req.params.id);
      const { data, error } = await createSupabaseAdminClient().rpc("review_manual_payment", {
        p_submission_id: submissionId,
        p_reviewer_id: reviewer.id,
        p_decision: decision,
        p_review_note: reviewNote || null,
      });
      if (error) {
        if (error.code === "P0002") return res.status(404).json({ error: error.message });
        if (error.code === "P0001") return res.status(409).json({ error: error.message });
        if (error.code === "42501") return res.status(403).json({ error: error.message });
        if (error.code === "22023") return res.status(400).json({ error: error.message });
        return res.status(500).json({ error: "Unable to review manual payment" });
      }
      res.json(data);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      res.status(500).json({ error: "Unable to review manual payment" });
    }
  });

  app.post("/api/payments/coupons/redeem", async (req, res) => {
    try {
      const user = await verifyAccessToken(req);
      if (!user) return res.status(401).json({ error: "Valid Supabase session required" });
      const { code } = z.object({ code: z.string().trim().min(1).max(80) }).parse(req.body);
      const client = createSupabaseAdminClient();
      const { error: redemptionError } = await client.rpc("redeem_free_subscription_coupon", {
        p_user_id: user.id,
        p_code: code.toUpperCase(),
      });
      if (redemptionError) {
        const status = redemptionError.code === "P0001" ? 400 : 500;
        return res.status(status).json({ error: status === 400 ? redemptionError.message : "Coupon redemption failed" });
      }

      const { data: profile, error: profileError } = await client.from("profiles").select("*").eq("id", user.id).single();
      if (profileError || !profile) return res.status(500).json({ error: "Coupon redeemed, but profile refresh failed" });
      res.json({ profile });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      res.status(500).json({ error: "Coupon redemption failed" });
    }
  });

  app.post("/api/payments/paystack/webhook", async (req, res) => {
    try {
      const { secretKey } = getPaystackConfig();
      const signature = req.header("x-paystack-signature");
      const rawBody = Buffer.isBuffer(req.rawBody) ? req.rawBody : Buffer.from(JSON.stringify(req.body));
      const expected = createHmac("sha512", secretKey).update(rawBody).digest("hex");
      if (!signature || signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
        return res.status(401).json({ error: "Invalid Paystack signature" });
      }

      const event = req.body as { event?: string; data?: { reference?: string; amount?: number; currency?: string; status?: string; paid_at?: string } };
      const reference = event.data?.reference;
      if (!reference) return res.status(400).json({ error: "Payment reference missing" });
      const client = createSupabaseAdminClient();
      const { data: payment, error: paymentError } = await client.from("payments").select("*").eq("provider", "paystack").eq("provider_ref", reference).maybeSingle();
      if (paymentError) return res.status(500).json({ error: paymentError.message });
      if (!payment) return res.status(404).json({ error: "Payment record not found" });

      let nextStatus: "success" | "failed" | "refunded" | undefined;
      if (event.event === "charge.success") nextStatus = "success";
      if (event.event === "charge.failed") nextStatus = "failed";
      if (event.event === "refund.processed") nextStatus = "refunded";
      if (!nextStatus) return res.json({ received: true });
      if (payment.status === nextStatus || (payment.status === "success" && nextStatus === "failed") || (payment.status === "refunded" && nextStatus !== "refunded")) {
        return res.json({ received: true });
      }
      if (nextStatus === "success") {
        if (event.data?.status !== "success") return res.status(400).json({ error: "Paystack transaction is not successful" });
        if (event.data.amount !== Number(payment.amount) * 100) return res.status(400).json({ error: "Payment amount mismatch" });
        if (event.data.currency !== payment.currency) return res.status(400).json({ error: "Payment currency mismatch" });
      }

      const { error: updateError } = await client.from("payments").update({ status: nextStatus, metadata: { ...(payment.metadata || {}), webhook_event: event.event } }).eq("id", payment.id);
      if (updateError) return res.status(500).json({ error: updateError.message });
      if (nextStatus === "success") {
        const plan = isPaymentPlanId(payment.metadata?.plan) ? payment.metadata.plan : "one-time";
        const paidAt = event.data?.paid_at ? new Date(event.data.paid_at) : undefined;
        await updateSubscriptionAccess(
          payment.user_id,
          true,
          reference,
          plan,
          paidAt && Number.isFinite(paidAt.getTime()) ? paidAt : undefined,
        );
      }
      if (nextStatus === "failed" || nextStatus === "refunded") await updateSubscriptionAccess(payment.user_id, false, reference);
      res.json({ received: true });
    } catch (error) {
      if (error instanceof Error && error.message.includes("Paystack")) return res.status(503).json({ error: error.message });
      res.status(500).json({ error: "Webhook processing failed" });
    }
  });

  app.post("/api/admin/instructors", async (req, res) => {
    try {
      const data = z.object({
        fullName: z.string().min(2),
        email: z.string().email(),
        password: z.string().min(8).optional(),
      }).parse(req.body);

      const authorization = req.header("Authorization");
      const accessToken = authorization?.startsWith("Bearer ")
        ? authorization.slice("Bearer ".length)
        : undefined;
      if (!accessToken) {
        return res.status(401).json({ error: "Supabase access token required" });
      }

      const authClient = createSupabaseAuthClient();
      const { data: authUser, error: authUserError } = await authClient.auth.getUser(accessToken);
      if (authUserError || !authUser.user) {
        return res.status(401).json({ error: "Invalid Supabase session" });
      }

      const adminClient = createSupabaseAdminClient();
      const { data: requesterProfile, error: requesterError } = await adminClient
        .from("profiles")
        .select("role")
        .eq("id", authUser.user.id)
        .single();
      if (requesterError || !requesterProfile || !isSuperAdmin(requesterProfile.role)) {
        return res.status(403).json({ error: "Only an admin can create instructor accounts" });
      }

      const temporaryPassword = data.password || generateTemporaryPassword();
      const { data: createdAuthUser, error: createError } = await adminClient.auth.admin.createUser({
        email: data.email,
        password: temporaryPassword,
        email_confirm: true,
        user_metadata: { full_name: data.fullName },
      });
      if (createError || !createdAuthUser.user) {
        return res.status(400).json({ error: createError?.message || "Failed to create instructor account" });
      }

      const { data: profile, error: profileError } = await adminClient
        .from("profiles")
        .upsert({
          id: createdAuthUser.user.id,
          email: data.email,
          full_name: data.fullName,
          role: "instructor",
        }, { onConflict: "id" })
        .select("*")
        .single();
      if (profileError || !profile) {
        await adminClient.auth.admin.deleteUser(createdAuthUser.user.id);
        return res.status(500).json({ error: profileError?.message || "Failed to create instructor profile" });
      }

      res.status(201).json({
        user: {
          id: profile.id,
          email: profile.email,
          fullName: profile.full_name,
          role: profile.role,
          hasActiveSubscription: profile.has_active_subscription,
          subscriptionTier: profile.subscription_tier,
          subscriptionPaidAt: profile.subscription_paid_at,
          subscriptionExpiresAt: profile.subscription_expires_at,
          state: profile.state ?? null,
          localGovernmentArea: profile.local_government_area ?? null,
          phoneNumber: profile.phone_number ?? null,
          whatsappNumber: profile.whatsapp_number ?? null,
          referralCode: profile.referral_code ?? null,
        },
        temporaryPassword,
        delivery: "manual",
      });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      if (error instanceof Error && error.message.startsWith("Missing VITE_SUPABASE")) {
        return res.status(503).json({ error: "Supabase server configuration is missing" });
      }
      res.status(500).json({ error: "Failed to create instructor account" });
    }
  });

  app.post("/api/admin/modules", async (req, res) => {
    const requester = await requireAdmin(req.body.userId, res);
    if (!requester) return;
    try {
      const data = insertModuleSchema.parse(req.body.module);
      const course = await storage.getCourse(data.courseId);
      if (!course) return res.status(404).json({ error: "Course not found" });
      if (!isSuperAdmin(requester.role) && course.instructorId !== requester.id) {
        return res.status(403).json({ error: "You can only add modules to your assigned courses" });
      }
      const referencedModuleIds = [data.parentModuleId, data.prerequisiteModuleId].filter(Boolean) as string[];
      for (const referencedModuleId of referencedModuleIds) {
        const referencedModule = await storage.getModule(referencedModuleId);
        if (!referencedModule || referencedModule.courseId !== data.courseId) {
          return res.status(400).json({ error: "Parent and prerequisite modules must belong to this course" });
        }
      }
      res.json(await storage.createModule(data));
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      res.status(500).json({ error: "Failed to create module" });
    }
  });

  app.delete("/api/admin/modules/:id", async (req, res) => {
    if (!(await requireAdmin(req.query.userId, res))) return;
    res.json({ deleted: await storage.deleteModule(req.params.id) });
  });

  const canManageCbtQuestion = (requester: { id: string; role: string }, createdBy: string) =>
    isSuperAdmin(requester.role) || requester.id === createdBy;

  app.get("/api/cbt/catalog", async (req, res) => {
    try {
      if (!(await requireAuthenticatedStudent(req, res))) return;
      res.json(await storage.getCbtQuestionCatalog());
    } catch {
      res.status(500).json({ error: "Failed to fetch available CBT questions" });
    }
  });

  app.get("/api/cbt/attempts", async (req, res) => {
    try {
      const student = await requireAuthenticatedStudent(req, res);
      if (!student) return;
      const active = await storage.getActiveCbtAttempt(student.id);
      if (active && active.expiresAt.getTime() <= Date.now()) await finalizeCbtAttempt(active, true);
      const attempts = await storage.getCbtAttemptsForUser(student.id);
      res.json(attempts.map(toCbtAttemptHistoryEntry));
    } catch {
      res.status(500).json({ error: "Failed to fetch CBT attempt history" });
    }
  });

  app.get("/api/cbt/attempts/active", async (req, res) => {
    try {
      const student = await requireAuthenticatedStudent(req, res);
      if (!student) return;
      const attempt = await storage.getActiveCbtAttempt(student.id);
      if (!attempt) return res.json(null);
      const current = attempt.expiresAt.getTime() <= Date.now()
        ? await finalizeCbtAttempt(attempt, true)
        : attempt;
      res.json(toCbtStudentAttempt(current));
    } catch {
      res.status(500).json({ error: "Failed to fetch the active CBT attempt" });
    }
  });

  app.post("/api/cbt/attempts", async (req, res) => {
    let studentId: string | undefined;
    try {
      const student = await requireAuthenticatedStudent(req, res);
      if (!student) return;
      studentId = student.id;
      const input = cbtAttemptRequestSchema.parse(req.body);

      const recentAttemptCount = await storage.countCbtAttemptsSince(
        student.id,
        new Date(Date.now() - 60_000),
      );
      if (recentAttemptCount >= 10) {
        return res.status(429).json({ error: "Please wait a minute before starting another test." });
      }

      const activeAttempt = await storage.getActiveCbtAttempt(student.id);
      if (activeAttempt) {
        if (activeAttempt.expiresAt.getTime() <= Date.now()) {
          await finalizeCbtAttempt(activeAttempt, true);
        } else {
          return res.status(409).json({
            error: "Finish or resume your active CBT attempt before starting another.",
            attemptId: activeAttempt.id,
          });
        }
      }

      const catalog = await storage.getCbtQuestionCatalog();
      const canonicalSelections: CbtAttemptSelection[] = [];
      const questionsToUse: CbtQuestion[] = [];
      for (const selection of input.selections) {
        const matchingCatalog = catalog.filter((entry) =>
          entry.examType === input.examType
          && entry.subject.toLowerCase() === selection.subject.toLowerCase()
          && (selection.examYear === undefined || entry.examYear === selection.examYear)
          && (!selection.topics || selection.topics.includes(entry.topic)),
        );
        const availableCount = matchingCatalog.reduce((total, entry) => total + entry.count, 0);
        const canonicalSubject = matchingCatalog[0]?.subject;
        if (!canonicalSubject) {
          return res.status(422).json({
            error: `No published ${selection.subject} questions are available for this ${input.examType.toUpperCase()} selection.`,
          });
        }
        if (selection.questionCount > availableCount) {
          return res.status(422).json({
            error: `Only ${availableCount} published ${canonicalSubject} questions match your selection.`,
            availableCount,
          });
        }
        canonicalSelections.push({ ...selection, subject: canonicalSubject });
        const bank = await storage.getCbtQuestions({
          examType: input.examType,
          subject: canonicalSubject,
          ...(selection.examYear !== undefined ? { examYear: selection.examYear } : {}),
          ...(selection.topics ? { topics: selection.topics } : { requireTopic: true }),
          status: "published",
        });
        if (bank.length < selection.questionCount) {
          return res.status(409).json({ error: "The question bank changed. Refresh the subject list and try again." });
        }
        questionsToUse.push(...sampleCbtQuestionsAcrossTopics(bank, selection.questionCount));
      }

      const startedAt = new Date();
      const expiresAt = new Date(startedAt.getTime() + input.durationMinutes * 60_000);
      const attempt = await storage.createCbtAttempt({
        userId: student.id,
        examType: input.examType,
        mode: input.mode,
        selections: canonicalSelections,
        durationMinutes: input.durationMinutes,
        questions: shuffleCbtQuestions(questionsToUse),
        status: "in_progress",
        startedAt,
        expiresAt,
      });
      res.status(201).json(toCbtStudentAttempt(attempt));
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      if (
        error instanceof Error
        && (error.message.includes("idx_cbt_attempts_one_active_per_user")
          || error.message.includes("An active CBT attempt already exists"))
      ) {
        const activeAttempt = studentId ? await storage.getActiveCbtAttempt(studentId) : undefined;
        if (activeAttempt) {
          return res.status(409).json({
            error: "Another CBT attempt was started in a different session.",
            attemptId: activeAttempt.id,
          });
        }
      }
      res.status(500).json({ error: "Failed to start CBT attempt" });
    }
  });

  app.get("/api/cbt/attempts/:id", async (req, res) => {
    try {
      const student = await requireAuthenticatedStudent(req, res);
      if (!student) return;
      const id = z.string().uuid().parse(req.params.id);
      const attempt = await storage.getCbtAttempt(id);
      if (!attempt || attempt.userId !== student.id) {
        return res.status(404).json({ error: "CBT attempt not found" });
      }
      const current = attempt.status === "in_progress" && attempt.expiresAt.getTime() <= Date.now()
        ? await finalizeCbtAttempt(attempt, true)
        : attempt;
      res.json(toCbtStudentAttempt(current));
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      res.status(500).json({ error: "Failed to fetch CBT attempt" });
    }
  });

  app.patch("/api/cbt/attempts/:id/answers", async (req, res) => {
    try {
      const student = await requireAuthenticatedStudent(req, res);
      if (!student) return;
      const id = z.string().uuid().parse(req.params.id);
      const input = z.object({
        questionId: z.string().uuid(),
        selectedOption: z.number().int().min(1).max(4).nullable(),
      }).parse(req.body);
      const attempt = await storage.getCbtAttempt(id);
      if (!attempt || attempt.userId !== student.id) {
        return res.status(404).json({ error: "CBT attempt not found" });
      }
      if (attempt.status !== "in_progress") {
        return res.status(409).json({ error: "This CBT attempt is already finished." });
      }
      if (attempt.expiresAt.getTime() <= Date.now()) {
        const finished = await finalizeCbtAttempt(attempt, true);
        return res.status(409).json({ error: "The time limit has ended.", attempt: toCbtStudentAttempt(finished) });
      }
      if (!attempt.questions.some((question) => question.id === input.questionId)) {
        return res.status(400).json({ error: "Question does not belong to this attempt." });
      }
      const saved = await storage.saveCbtAttemptAnswer(
        id,
        student.id,
        input.questionId,
        input.selectedOption,
      );
      if (!saved) {
        const refreshed = await storage.getCbtAttempt(id);
        if (refreshed?.status === "in_progress" && refreshed.expiresAt.getTime() <= Date.now()) {
          const finished = await finalizeCbtAttempt(refreshed, true);
          return res.status(409).json({ error: "The time limit has ended.", attempt: toCbtStudentAttempt(finished) });
        }
        return res.status(409).json({ error: "This answer could not be saved because the attempt is no longer active." });
      }
      res.json({ questionId: input.questionId, selectedOption: input.selectedOption });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      res.status(500).json({ error: "Failed to save CBT answer" });
    }
  });

  app.post("/api/cbt/attempts/:id/submit", async (req, res) => {
    try {
      const student = await requireAuthenticatedStudent(req, res);
      if (!student) return;
      const id = z.string().uuid().parse(req.params.id);
      const attempt = await storage.getCbtAttempt(id);
      if (!attempt || attempt.userId !== student.id) {
        return res.status(404).json({ error: "CBT attempt not found" });
      }
      const finished = await finalizeCbtAttempt(attempt);
      res.json(toCbtStudentAttempt(finished));
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      res.status(500).json({ error: "Failed to submit CBT attempt" });
    }
  });

  const getCbtQuestionOrRespond = async (id: string, requester: { id: string; role: string }, res: Response) => {
    const question = await storage.getCbtQuestion(id);
    if (!question) {
      res.status(404).json({ error: "CBT question not found" });
      return undefined;
    }
    if (!canManageCbtQuestion(requester, question.createdBy)) {
      res.status(403).json({ error: "You can only manage CBT questions you created" });
      return undefined;
    }
    return question;
  };

  app.get("/api/admin/cbt/questions", async (req, res) => {
    try {
      const requester = await requireAuthenticatedStaff(req, res);
      if (!requester) return;
      const filters = z.object({
        subject: z.string().trim().min(1).max(80).optional(),
        examYear: z.coerce.number().int().min(1950).max(2100).optional(),
        status: z.enum(["draft", "published", "archived"]).optional(),
      }).parse(req.query);
      const questions = await storage.getCbtQuestions({
        ...filters,
        ...(!isSuperAdmin(requester.role) ? { createdBy: requester.id } : {}),
      });
      res.json(questions);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      res.status(500).json({ error: "Failed to fetch CBT questions" });
    }
  });

  app.post("/api/admin/cbt/questions", async (req, res) => {
    try {
      const requester = await requireAuthenticatedStaff(req, res);
      if (!requester) return;
      const input = cbtQuestionInputSchema.parse(req.body);
      const [question] = await storage.createCbtQuestions([{ ...input, createdBy: requester.id }]);
      res.status(201).json(question);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      res.status(500).json({ error: "Failed to create CBT question" });
    }
  });

  app.post("/api/admin/cbt/questions/import", async (req, res) => {
    try {
      const requester = await requireAuthenticatedStaff(req, res);
      if (!requester) return;
      const input = z.object({
        examType: cbtExamTypeSchema,
        subject: z.string().trim().min(1).max(80),
        examYear: z.number().int().min(1950).max(2100),
        topic: z.string().trim().min(1).max(120),
        questions: z.array(z.object({
          question: z.string(),
          questionImageUrl: z.string().optional(),
          explanation: z.string().optional(),
          explanationImageUrl: z.string().optional(),
          options: z.array(z.string()).length(4),
          correctAnswer: z.number().int().min(1).max(4),
        })).min(1).max(200),
      }).parse(req.body);
      const questions = input.questions.map((question) => cbtQuestionInputSchema.parse({
        ...question,
        examType: input.examType,
        subject: input.subject,
        examYear: input.examYear,
        topic: input.topic,
        questionImageUrl: question.questionImageUrl || undefined,
        explanation: question.explanation || undefined,
        explanationImageUrl: question.explanationImageUrl || undefined,
      }));
      const created = await storage.createCbtQuestions(questions.map((question) => ({
        ...question,
        createdBy: requester.id,
      })));
      res.status(201).json({ imported: created.length, questions: created });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      res.status(500).json({ error: "Failed to import CBT questions" });
    }
  });

  app.post("/api/admin/cbt/questions/bulk-classify", async (req, res) => {
    try {
      const requester = await requireAuthenticatedStaff(req, res);
      if (!requester) return;
      const input = z.object({
        ids: z.array(z.string().uuid()).min(1).max(500),
        examType: cbtExamTypeSchema,
        topic: z.string().trim().min(1).max(120),
      }).parse(req.body);
      if (new Set(input.ids).size !== input.ids.length) {
        return res.status(400).json({ error: "Each question can only be selected once." });
      }

      const selectedQuestions = await storage.getCbtQuestions({
        ids: input.ids,
        ...(!isSuperAdmin(requester.role) ? { createdBy: requester.id } : {}),
      });
      if (selectedQuestions.length !== input.ids.length) {
        return res.status(403).json({ error: "You can only manage CBT questions you created." });
      }

      const updated = await storage.bulkClassifyCbtQuestions(
        input.ids,
        input.examType,
        input.topic,
        requester.id,
        isSuperAdmin(requester.role) ? undefined : requester.id,
      );
      if (updated !== input.ids.length) {
        return res.status(409).json({ error: "Some selected questions changed before they could be reclassified. Refresh the question bank and try again." });
      }
      res.json({ updated });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      res.status(500).json({ error: "Failed to bulk classify CBT questions" });
    }
  });

  app.patch("/api/admin/cbt/questions/:id", async (req, res) => {
    try {
      const requester = await requireAuthenticatedStaff(req, res);
      if (!requester) return;
      const id = z.string().uuid().parse(req.params.id);
      const existing = await getCbtQuestionOrRespond(id, requester, res);
      if (!existing) return;
      const input = cbtQuestionInputSchema.parse(req.body);
      const requiresReview = existing.status === "published";
      const updated = await storage.updateCbtQuestion(id, {
        ...input,
        updatedBy: requester.id,
        ...(requiresReview ? { status: "draft", publishedBy: null, publishedAt: null } : {}),
      });
      if (!updated) return res.status(404).json({ error: "CBT question not found" });
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      res.status(500).json({ error: "Failed to update CBT question" });
    }
  });

  app.post("/api/admin/cbt/questions/:id/publish", async (req, res) => {
    try {
      const requester = await requireAuthenticatedStaff(req, res);
      if (!requester) return;
      const id = z.string().uuid().parse(req.params.id);
      const existing = await getCbtQuestionOrRespond(id, requester, res);
      if (!existing) return;
      if (existing.status !== "draft") return res.status(409).json({ error: "Only draft CBT questions can be published" });
      const question = await storage.updateCbtQuestion(id, {
        status: "published",
        updatedBy: requester.id,
        publishedBy: requester.id,
        publishedAt: new Date(),
        archivedAt: null,
      });
      if (!question) return res.status(404).json({ error: "CBT question not found" });
      res.json(question);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      res.status(500).json({ error: "Failed to publish CBT question" });
    }
  });

  app.post("/api/admin/cbt/questions/:id/archive", async (req, res) => {
    try {
      const requester = await requireAuthenticatedStaff(req, res);
      if (!requester) return;
      const id = z.string().uuid().parse(req.params.id);
      const existing = await getCbtQuestionOrRespond(id, requester, res);
      if (!existing) return;
      if (existing.status === "archived") return res.status(409).json({ error: "CBT question is already archived" });
      const question = await storage.updateCbtQuestion(id, {
        status: "archived",
        updatedBy: requester.id,
        archivedAt: new Date(),
      });
      if (!question) return res.status(404).json({ error: "CBT question not found" });
      res.json(question);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      res.status(500).json({ error: "Failed to archive CBT question" });
    }
  });

  app.post("/api/admin/cbt/questions/:id/restore", async (req, res) => {
    try {
      const requester = await requireAuthenticatedStaff(req, res);
      if (!requester) return;
      const id = z.string().uuid().parse(req.params.id);
      const existing = await getCbtQuestionOrRespond(id, requester, res);
      if (!existing) return;
      if (existing.status !== "archived") return res.status(409).json({ error: "Only archived CBT questions can be restored" });
      const question = await storage.updateCbtQuestion(id, {
        status: "draft",
        updatedBy: requester.id,
        publishedBy: null,
        publishedAt: null,
        archivedAt: null,
      });
      if (!question) return res.status(404).json({ error: "CBT question not found" });
      res.json(question);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      res.status(500).json({ error: "Failed to restore CBT question" });
    }
  });

  app.patch("/api/admin/modules/:id", async (req, res) => {
    const requester = await requireAdmin(req.body.userId, res);
    if (!requester) return;
    const existingModule = await storage.getModule(req.params.id);
    if (!existingModule) return res.status(404).json({ error: "Module not found" });
    const course = await storage.getCourse(existingModule.courseId);
    if (!course) return res.status(404).json({ error: "Course not found" });
    if (!isSuperAdmin(requester.role) && course.instructorId !== requester.id) {
      return res.status(403).json({ error: "You can only edit modules in your assigned courses" });
    }
    const data = insertModuleSchema.partial().parse(req.body.module || {});
    const targetCourseId = data.courseId || existingModule.courseId;
    const referencedModuleIds = [data.parentModuleId, data.prerequisiteModuleId].filter(Boolean) as string[];
    for (const referencedModuleId of referencedModuleIds) {
      const referencedModule = await storage.getModule(referencedModuleId);
      if (!referencedModule || referencedModule.courseId !== targetCourseId || referencedModule.id === req.params.id) {
        return res.status(400).json({ error: "Parent and prerequisite modules must belong to this course" });
      }
    }
    const module = await storage.updateModule(req.params.id, data);
    if (!module) return res.status(404).json({ error: "Module not found" });
    res.json(module);
  });

  app.get("/api/admin/quizzes", async (req, res) => {
    if (!(await requireAdmin(req.query.userId, res))) return;
    const quizzes = await storage.getAllQuizzes();
    res.json(quizzes.map((quiz) => ({
      ...quiz,
      questions: (JSON.parse(quiz.questions) as QuizQuestion[]).map(normalizeQuizQuestionIndex),
    })));
  });

  app.post("/api/admin/quizzes", async (req, res) => {
    const requester = await requireAdmin(req.body.userId, res);
    if (!requester) return;
    try {
      const input = z.object({ moduleId: z.string(), title: z.string().min(1), passScore: z.number().min(1).max(100), questions: z.array(quizQuestionInputSchema).min(1) }).parse(req.body.quiz);
      const module = await storage.getModule(input.moduleId);
      if (!module) return res.status(404).json({ error: "Module not found" });
      const course = await storage.getCourse(module.courseId);
      if (!course) return res.status(404).json({ error: "Course not found" });
      if (!isSuperAdmin(requester.role) && course.instructorId !== requester.id) {
        return res.status(403).json({ error: "You can only add quizzes to your assigned courses" });
      }
      const questions = input.questions.map(normalizeQuizQuestionIndex);
      const quiz = await storage.createQuiz({ ...input, questions: JSON.stringify(questions) });
      res.json({ ...quiz, questions });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      res.status(500).json({ error: "Failed to create quiz" });
    }
  });

  app.patch("/api/admin/quizzes/:id", async (req, res) => {
    const requester = await requireAdmin(req.body.userId, res);
    if (!requester) return;
    try {
      const input = z.object({
        moduleId: z.string().optional(),
        title: z.string().min(1).optional(),
        passScore: z.number().min(1).max(100).optional(),
        questions: z.array(quizQuestionInputSchema).min(1).optional(),
      }).parse(req.body.quiz || {});
      const existingQuiz = await storage.getQuiz(req.params.id);
      if (!existingQuiz) return res.status(404).json({ error: "Quiz not found" });

      const existingModule = await storage.getModule(existingQuiz.moduleId);
      const existingCourse = existingModule ? await storage.getCourse(existingModule.courseId) : undefined;
      if (!existingCourse) return res.status(404).json({ error: "Quiz module or course not found" });
      if (!isSuperAdmin(requester.role) && existingCourse.instructorId !== requester.id) {
        return res.status(403).json({ error: "You can only edit quizzes in your assigned courses" });
      }

      if (input.moduleId && input.moduleId !== existingQuiz.moduleId) {
        const targetModule = await storage.getModule(input.moduleId);
        const targetCourse = targetModule ? await storage.getCourse(targetModule.courseId) : undefined;
        if (!targetModule || !targetCourse) return res.status(404).json({ error: "Target module or course not found" });
        if (!isSuperAdmin(requester.role) && targetCourse.instructorId !== requester.id) {
          return res.status(403).json({ error: "You can only move quizzes to your assigned courses" });
        }
      }

      const questions = input.questions?.map(normalizeQuizQuestionIndex);
      const quiz = await storage.updateQuiz(req.params.id, { ...input, questions: questions ? JSON.stringify(questions) : undefined });
      if (!quiz) return res.status(404).json({ error: "Quiz not found" });
      res.json({ ...quiz, questions: questions ?? (JSON.parse(quiz.questions) as QuizQuestion[]).map(normalizeQuizQuestionIndex) });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      res.status(500).json({ error: "Failed to update quiz" });
    }
  });

  app.delete("/api/admin/quizzes/:id", async (req, res) => {
    if (!(await requireAdmin(req.query.userId, res))) return;
    res.json({ deleted: await storage.deleteQuiz(req.params.id) });
  });

  app.post("/api/admin/enrollments", async (req, res) => {
    const requester = await requireAuthenticatedStaff(req, res);
    if (!requester) return;
    try {
      const data = z.object({ userId: z.string().uuid(), courseId: z.string().uuid() }).parse(req.body);
      const course = await storage.getCourse(data.courseId);
      const student = await storage.getUser(data.userId);
      if (!course || !student || student.role !== "student") {
        return res.status(404).json({ error: "Course or student not found" });
      }
      if (!isSuperAdmin(requester.role) && course.instructorId !== requester.id) {
        return res.status(403).json({ error: "You can only manage enrollment for your assigned courses." });
      }
      res.json(await storage.enrollStudent(data.userId, data.courseId));
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      console.error("Failed to enroll student:", error);
      res.status(500).json({ error: "Failed to enroll student" });
    }
  });

  app.delete("/api/admin/enrollments", async (req, res) => {
    const requester = await requireAuthenticatedStaff(req, res);
    if (!requester) return;
    try {
      const data = z.object({ userId: z.string().uuid(), courseId: z.string().uuid() }).parse(req.body);
      const course = await storage.getCourse(data.courseId);
      if (!course) return res.status(404).json({ error: "Course not found" });
      if (!isSuperAdmin(requester.role) && course.instructorId !== requester.id) {
        return res.status(403).json({ error: "You can only manage enrollment for your assigned courses." });
      }
      res.json({ removed: await storage.removeCourseEnrollment(data.userId, data.courseId) });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      console.error("Failed to remove course enrollment:", error);
      res.status(500).json({ error: "Failed to remove enrollment" });
    }
  });

  app.get("/api/admin/courses/:courseId/progress", async (req, res) => {
    try {
      const requester = await requireAuthenticatedStaff(req, res);
      if (!requester) return;
      const courseId = z.string().uuid().parse(req.params.courseId);
      const course = await storage.getCourse(courseId);
      if (!course) return res.status(404).json({ error: "Course not found" });
      if (!isSuperAdmin(requester.role) && course.instructorId !== requester.id) {
        return res.status(403).json({ error: "You can only view progress for your assigned courses." });
      }

      const [enrollments, modules] = await Promise.all([
        storage.getCourseEnrollments(courseId),
        storage.getModulesByCourse(courseId),
      ]);
      const quizzes = await Promise.all(modules.map((module) => storage.getQuizByModule(module.id)));
      const quizByModuleId = new Map(
        quizzes.filter((quiz) => quiz).map((quiz) => [quiz!.moduleId, quiz!]),
      );
      const attempts = await storage.getQuizAttemptsForQuizzes(
        Array.from(quizByModuleId.keys()),
      );
      const moduleByQuizId = new Map(
        Array.from(quizByModuleId.values()).map((quiz) => [quiz.id, quiz.moduleId]),
      );
      const courseAttempts = attempts.filter((attempt) => moduleByQuizId.has(attempt.quizId));

      const learners = await Promise.all(enrollments.map(async (enrollment) => {
        const student = await storage.getUser(enrollment.userId);
        if (!student || student.role !== "student") return null;
        const [completions, passedQuizModuleIds] = await Promise.all([
          storage.getModuleCompletions(student.id, courseId),
          storage.getPassedQuizModuleIds(student.id, courseId),
        ]);
        const completionByModuleId = new Map(completions.map((completion) => [completion.moduleId, completion]));
        const studentAttempts = courseAttempts.filter((attempt) => attempt.userId === student.id);
        const latestAttemptByModuleId = new Map<string, typeof studentAttempts[number]>();
        for (const attempt of studentAttempts) {
          const moduleId = moduleByQuizId.get(attempt.quizId);
          if (!moduleId) continue;
          const existing = latestAttemptByModuleId.get(moduleId);
          if (!existing || attempt.attemptedAt > existing.attemptedAt) {
            latestAttemptByModuleId.set(moduleId, attempt);
          }
        }

        const learnerModules = modules.map((module) => {
          const completion = completionByModuleId.get(module.id);
          const quiz = quizByModuleId.get(module.id);
          const latestAttempt = latestAttemptByModuleId.get(module.id);
          return {
            id: module.id,
            title: module.title,
            order: module.order,
            parentModuleId: module.parentModuleId,
            isCompleted: !!completion,
            completedAt: completion?.completedAt ?? null,
            hasQuiz: !!quiz,
            isQuizPassed: passedQuizModuleIds.has(module.id),
            latestQuizScore: latestAttempt?.score ?? null,
            latestQuizTotal: latestAttempt?.totalQuestions ?? null,
            latestQuizPassed: latestAttempt?.passed ?? null,
            latestQuizAt: latestAttempt?.attemptedAt ?? null,
          };
        });
        const completedCount = learnerModules.filter((module) => module.isCompleted).length;
        const activityDates = [
          ...completions.map((completion) => completion.completedAt),
          ...studentAttempts.map((attempt) => attempt.attemptedAt),
        ];
        const lastActivityAt = activityDates.length
          ? activityDates.reduce((latest, date) => date > latest ? date : latest)
          : null;

        return {
          id: student.id,
          fullName: student.fullName,
          email: student.email,
          enrolledAt: enrollment.enrolledAt,
          progress: learnerModules.length ? Math.round((completedCount / learnerModules.length) * 100) : 0,
          completedModules: completedCount,
          totalModules: learnerModules.length,
          lastActivityAt,
          modules: learnerModules,
        };
      }));

      res.json({
        course: { id: course.id, title: course.title },
        learners: learners.filter((learner) => learner !== null),
      });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      console.error("Failed to fetch course learner progress:", error);
      res.status(500).json({ error: "Failed to fetch course progress" });
    }
  });

  app.post("/api/admin/progress/reset", async (req, res) => {
    const requester = await requireAuthenticatedStaff(req, res);
    if (!requester) return;
    try {
      const data = z.object({ userId: z.string().uuid(), courseId: z.string().uuid().optional() }).parse(req.body);
      if (!data.courseId && !isSuperAdmin(requester.role)) {
        return res.status(403).json({ error: "Instructors can only reset progress for a course they teach." });
      }
      if (data.courseId) {
        const course = await storage.getCourse(data.courseId);
        if (!course) return res.status(404).json({ error: "Course not found" });
        if (!isSuperAdmin(requester.role) && course.instructorId !== requester.id) {
          return res.status(403).json({ error: "You can only reset progress for your assigned courses." });
        }
      }
      await storage.resetUserProgress(data.userId, data.courseId);
      res.json({ reset: true });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      console.error("Failed to reset learner progress:", error);
      res.status(500).json({ error: "Failed to reset progress" });
    }
  });

  app.get("/api/admin/analytics", async (req, res) => {
    if (!(await requireAdmin(req.query.userId, res))) return;
    const [courses, users, attempts, allEnrollments] = await Promise.all([
      storage.getAllCourses(),
      storage.getAllUsers(),
      storage.getAllQuizAttempts(),
      storage.getAllCourseEnrollments(),
    ]);
    const courseStats = await Promise.all(courses.map(async (course) => {
      const modules = await storage.getModulesByCourse(course.id);
      const enrollments = allEnrollments.filter((item) => item.courseId === course.id);
      const completed = (await Promise.all(enrollments.map((item) => storage.getModuleCompletions(item.userId, course.id)))).flat();
      return { id: course.id, title: course.title, enrollments: enrollments.length, completionRate: modules.length && enrollments.length ? Math.round((completed.length / (modules.length * enrollments.length)) * 100) : 0 };
    }));
    res.json({ totalUsers: users.length, totalCourses: courses.length, totalEnrollments: allEnrollments.length, quizAttempts: attempts.length, passedQuizzes: attempts.filter((attempt) => attempt.passed).length, courseStats });
  });

  // Module routes
  app.get("/api/modules/course/:courseId", async (req, res) => {
    try {
      const modules = await storage.getModulesByCourse(req.params.courseId);
      const modulesWithQuiz = await Promise.all(
        modules.map(async (module) => ({
          ...module,
          hasQuiz: !!(await storage.getQuizByModule(module.id)),
        })),
      );
      res.json(modulesWithQuiz);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch modules" });
    }
  });

  app.get("/api/modules/:id", async (req, res) => {
    try {
      const module = await storage.getModule(req.params.id);
      if (!module) {
        return res.status(404).json({ error: "Module not found" });
      }
      res.json(module);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch module" });
    }
  });

  // Module completion routes
  app.get("/api/module-completions/:userId/:courseId", async (req, res) => {
    try {
      const requester = await requireAuthenticatedMessagingUser(req, res);
      if (!requester) return;
      if (requester.id !== req.params.userId) return res.status(403).json({ error: "You can only view your own progress." });
      const completions = await storage.getModuleCompletions(
        req.params.userId,
        req.params.courseId,
      );
      res.json(completions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch module completions" });
    }
  });

  app.post("/api/module-completions", async (req, res) => {
    try {
      const data = insertModuleCompletionSchema.parse(req.body);
      const student = await requireAuthenticatedStudent(req, res);
      if (!student) return;
      if (student.id !== data.userId) return res.status(403).json({ error: "You can only update your own progress." });
      const module = await storage.getModule(data.moduleId);
      if (!module) {
        return res.status(404).json({ error: "Module not found" });
      }
      if (!(await storage.isStudentEnrolled(student.id, module.courseId))) {
        return res.status(403).json({ error: "Enroll in this course before recording progress." });
      }

      if (!(await canAccessModule(data.userId, module))) {
        return res.status(403).json({ error: "Complete the previous module and its quiz, if present, first" });
      }

      const currentQuiz = await storage.getQuizByModule(module.id);
      if (currentQuiz && !(await storage.getPassedQuizModuleIds(data.userId, module.courseId)).has(module.id)) {
        return res.status(403).json({ error: "Pass this module's quiz before marking it complete" });
      }
      
      // Check if already completed
      const isCompleted = await storage.isModuleCompleted(data.userId, data.moduleId);
      if (isCompleted) {
        return res.status(400).json({ error: "Module already completed" });
      }

      const completion = await storage.markModuleComplete(data);
      res.json(completion);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to mark module complete" });
    }
  });

  // Quiz routes
  app.get("/api/quizzes/module/:moduleId", async (req, res) => {
    try {
      const quiz = await storage.getQuizByModule(req.params.moduleId);
      if (!quiz) {
        return res.status(404).json({ error: "Quiz not found for this module" });
      }
      
      // Parse questions and send them
      const questions = (JSON.parse(quiz.questions) as QuizQuestion[]).map(normalizeQuizQuestionIndex);
      res.json({
        id: quiz.id,
        moduleId: quiz.moduleId,
        title: quiz.title,
        passScore: quiz.passScore,
        questions,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch quiz" });
    }
  });

  app.get("/api/quizzes/:id", async (req, res) => {
    try {
      const quiz = await storage.getQuiz(req.params.id);
      if (!quiz) {
        return res.status(404).json({ error: "Quiz not found" });
      }
      
      const questions = (JSON.parse(quiz.questions) as QuizQuestion[]).map(normalizeQuizQuestionIndex);
      res.json({
        id: quiz.id,
        moduleId: quiz.moduleId,
        title: quiz.title,
        passScore: quiz.passScore,
        questions,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch quiz" });
    }
  });

  // Quiz attempt routes
  app.get("/api/quiz-attempts/:userId/:quizId", async (req, res) => {
    try {
      const requester = await requireAuthenticatedMessagingUser(req, res);
      if (!requester) return;
      if (requester.id !== req.params.userId) return res.status(403).json({ error: "You can only view your own quiz attempts." });
      const attempts = await storage.getQuizAttempts(
        req.params.userId,
        req.params.quizId,
      );
      res.json(attempts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch quiz attempts" });
    }
  });

  app.post("/api/quiz-attempts", async (req, res) => {
    try {
      const data = insertQuizAttemptSchema.parse(req.body);
      const student = await requireAuthenticatedStudent(req, res);
      if (!student) return;
      if (student.id !== data.userId) return res.status(403).json({ error: "You can only submit your own quiz attempts." });
      const quiz = await storage.getQuiz(data.quizId);
      if (!quiz) {
        return res.status(404).json({ error: "Quiz not found" });
      }

      const module = await storage.getModule(quiz.moduleId);
      if (!module) return res.status(404).json({ error: "Module not found" });
      if (!(await storage.isStudentEnrolled(student.id, module.courseId))) {
        return res.status(403).json({ error: "Enroll in this course before taking its quizzes." });
      }
      if (!(await canAccessModule(data.userId, module))) {
        return res.status(403).json({ error: "Complete the previous module and its quiz, if present, first" });
      }

      const percentage = data.totalQuestions > 0 ? (data.score / data.totalQuestions) * 100 : 0;
      const attempt = await storage.createQuizAttempt({
        ...data,
        passed: percentage >= quiz.passScore,
      });
      res.json(attempt);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to save quiz attempt" });
    }
  });

  app.get("/api/quiz-progress/:userId/:courseId", async (req, res) => {
    try {
      const requester = await requireAuthenticatedMessagingUser(req, res);
      if (!requester) return;
      if (requester.id !== req.params.userId) return res.status(403).json({ error: "You can only view your own quiz progress." });
      const passedModuleIds = await storage.getPassedQuizModuleIds(req.params.userId, req.params.courseId);
      res.json({ passedModuleIds: Array.from(passedModuleIds) });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch quiz progress" });
    }
  });

  app.get("/api/dashboard/:userId/leaderboard", async (req, res) => {
    try {
      const requester = await requireAuthenticatedMessagingUser(req, res);
      if (!requester) return;
      if (requester.id !== req.params.userId) return res.status(403).json({ error: "You can only view your own leaderboard status." });
      const attempts = (await storage.getAllQuizAttempts()).filter((attempt) => attempt.userId === req.params.userId);
      const totalQuestions = attempts.reduce((sum, attempt) => sum + attempt.totalQuestions, 0);
      const totalCorrect = attempts.reduce((sum, attempt) => sum + attempt.score, 0);
      const overallScore = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
      const tier = overallScore >= 80 ? "gold" : overallScore >= 60 ? "silver" : "bronze";

      res.json({
        overallScore,
        tier,
        quizzesTaken: attempts.length,
        totalQuestions,
        tiers: [
          { id: "gold", label: "Gold", minimumScore: 80, description: "Outstanding performance" },
          { id: "silver", label: "Silver", minimumScore: 60, description: "Strong progress" },
          { id: "bronze", label: "Bronze", minimumScore: 0, description: "Keep building your skills" },
        ],
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to calculate leaderboard status" });
    }
  });

  // Project routes
  app.get("/api/projects/user/:userId", async (req, res) => {
    try {
      const projects = await storage.getUserProjects(req.params.userId);
      res.json(projects);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch projects" });
    }
  });

  app.get("/api/projects/:id", async (req, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch project" });
    }
  });

  app.post("/api/projects", async (req, res) => {
    try {
      const data = insertProjectSchema.parse(req.body);
      const project = await storage.createProject(data);
      res.json(project);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create project" });
    }
  });

  // Dashboard stats route
  app.get("/api/dashboard/:userId", async (req, res) => {
    try {
      const userId = req.params.userId;
      const requester = await requireAuthenticatedMessagingUser(req, res);
      if (!requester) return;
      if (requester.id !== userId) return res.status(403).json({ error: "You can only view your own dashboard." });
      
      const allCourses = await storage.getAllCourses();
      const visibleCourses = allCourses.filter((course) => course.isPublished);

      const coursesWithProgress = await Promise.all(
        visibleCourses.map(async (course) => {
          const isEnrolled = await storage.isStudentEnrolled(userId, course.id);
          const modules = await storage.getModulesByCourse(course.id);
          const completions = isEnrolled ? await storage.getModuleCompletions(userId, course.id) : [];
          const completedModules = completions.length;
          const totalModules = modules.length;
          const progress = totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0;

          return {
            ...course,
            isUnlocked: true,
            isEnrolled,
            progress,
            totalModules: isEnrolled ? totalModules : 0,
            completedModules,
          };
        }),
      );
      
      res.json(coursesWithProgress);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch dashboard data" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
