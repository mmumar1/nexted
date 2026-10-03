import type { Express } from "express";
import { createServer, type Server } from "http";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
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
  type Module,
  type QuizQuestion,
} from "../shared/schema.js";
import { z } from "zod";
import { createSupabaseAdminClient, createSupabaseAuthClient } from "./supabase-admin.js";
import { compareModuleOrder } from "../shared/module-utils.js";

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

  const isSuperAdmin = (role?: string | null) => ["admin", "super_admin", "superadmin"].includes(role || "");

  const canAccessModule = async (userId: string, module: Module) => {
    const courseModules = await storage.getModulesByCourse(module.courseId);
    const orderedModules = courseModules.sort((a, b) => compareModuleOrder(a, b, courseModules));
    const moduleIndex = orderedModules.findIndex((item) => item.id === module.id);
    if (moduleIndex < 0) return false;

    const requirements = new Map<string, Module>();
    if (moduleIndex > 0) requirements.set(orderedModules[moduleIndex - 1].id, orderedModules[moduleIndex - 1]);
    if (module.prerequisiteModuleId) {
      const prerequisite = orderedModules.find((item) => item.id === module.prerequisiteModuleId)
        ?? await storage.getModule(module.prerequisiteModuleId);
      if (!prerequisite) return false;
      requirements.set(prerequisite.id, prerequisite);
    }

    const passedQuizModuleIds = await storage.getPassedQuizModuleIds(userId, module.courseId);
    for (const requirement of Array.from(requirements.values())) {
      const hasQuiz = !!(await storage.getQuizByModule(requirement.id));
      const requirementSatisfied = hasQuiz
        ? passedQuizModuleIds.has(requirement.id)
        : await storage.isModuleCompleted(userId, requirement.id);
      if (!requirementSatisfied) return false;
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

  // User course routes (unlocking)
  app.get("/api/user-courses/:userId", async (req, res) => {
    try {
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
    const requester = await requireAdmin(req.body.userId, res);
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

  const getPaystackConfig = () => {
    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    const amount = Number(process.env.PAYSTACK_PLAN_AMOUNT || "100000");
    const callbackUrl = process.env.PAYSTACK_CALLBACK_URL || "http://localhost:5000/profile";
    if (!secretKey || secretKey.includes("replace_with")) {
      throw new Error("Paystack server configuration is missing");
    }
    if (!Number.isInteger(amount) || amount <= 0) throw new Error("PAYSTACK_PLAN_AMOUNT must be a positive integer in kobo");
    return { secretKey, amount, callbackUrl };
  };

  const verifyAccessToken = async (req: any) => {
    const authorization = req.header("Authorization");
    const accessToken = authorization?.startsWith("Bearer ") ? authorization.slice(7) : undefined;
    if (!accessToken) return undefined;
    const { data, error } = await createSupabaseAuthClient().auth.getUser(accessToken);
    if (error || !data.user) return undefined;
    return data.user;
  };

  const updateSubscriptionAccess = async (userId: string, active: boolean, reference: string) => {
    const client = createSupabaseAdminClient();
    const { error: profileError } = await client.from("profiles").update({
      has_active_subscription: active,
      subscription_tier: active ? "one-time" : "none",
      subscription_paid_at: active ? new Date().toISOString() : null,
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
        const { error } = await client.from("user_courses").insert(missing.map((course) => ({
          user_id: userId,
          course_id: course.id,
          access_source: "subscription",
        })));
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
      const { secretKey, amount, callbackUrl } = getPaystackConfig();
      const reference = `learnpedia_${randomBytes(12).toString("hex")}`;
      const paystackResponse = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email, amount, currency: "NGN", reference, callback_url: callbackUrl }),
      });
      const result = await paystackResponse.json() as { status?: boolean; message?: string; data?: { authorization_url: string; access_code: string; reference: string } };
      if (!paystackResponse.ok || !result.status || !result.data) return res.status(502).json({ error: result.message || "Paystack initialization failed" });

      const { error } = await createSupabaseAdminClient().from("payments").insert({
        user_id: user.id,
        provider: "paystack",
        provider_ref: result.data.reference,
        amount: amount / 100,
        currency: "NGN",
        status: "pending",
        metadata: { access_code: result.data.access_code },
      });
      if (error) return res.status(500).json({ error: error.message });
      res.json({ authorizationUrl: result.data.authorization_url, reference: result.data.reference });
    } catch (error) {
      if (error instanceof Error && (error.message.includes("Paystack") || error.message.includes("PAYSTACK"))) return res.status(503).json({ error: error.message });
      res.status(500).json({ error: "Unable to initialize payment" });
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

      const event = req.body as { event?: string; data?: { reference?: string; amount?: number; status?: string } };
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
      if (nextStatus === "success" && event.data?.amount !== undefined && event.data.amount !== Number(payment.amount) * 100) {
        return res.status(400).json({ error: "Payment amount mismatch" });
      }

      const { error: updateError } = await client.from("payments").update({ status: nextStatus, metadata: { ...(payment.metadata || {}), webhook_event: event.event } }).eq("id", payment.id);
      if (updateError) return res.status(500).json({ error: updateError.message });
      if (nextStatus === "success") await updateSubscriptionAccess(payment.user_id, true, reference);
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
    res.json(quizzes.map((quiz) => ({ ...quiz, questions: JSON.parse(quiz.questions) })));
  });

  app.post("/api/admin/quizzes", async (req, res) => {
    const requester = await requireAdmin(req.body.userId, res);
    if (!requester) return;
    try {
      const input = z.object({ moduleId: z.string(), title: z.string().min(1), passScore: z.number().min(1).max(100), questions: z.array(z.object({ id: z.string(), question: z.string().min(1), options: z.array(z.string()).min(2), correctAnswer: z.number().int().min(0) })) }).parse(req.body.quiz);
      const module = await storage.getModule(input.moduleId);
      if (!module) return res.status(404).json({ error: "Module not found" });
      const course = await storage.getCourse(module.courseId);
      if (!course) return res.status(404).json({ error: "Course not found" });
      if (!isSuperAdmin(requester.role) && course.instructorId !== requester.id) {
        return res.status(403).json({ error: "You can only add quizzes to your assigned courses" });
      }
      const quiz = await storage.createQuiz({ ...input, questions: JSON.stringify(input.questions) });
      res.json({ ...quiz, questions: input.questions });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      res.status(500).json({ error: "Failed to create quiz" });
    }
  });

  app.patch("/api/admin/quizzes/:id", async (req, res) => {
    if (!(await requireAdmin(req.body.userId, res))) return;
    const input = z.object({ moduleId: z.string().optional(), title: z.string().min(1).optional(), passScore: z.number().min(1).max(100).optional(), questions: z.array(z.object({ id: z.string(), question: z.string().min(1), options: z.array(z.string()).min(2), correctAnswer: z.number().int().min(0) })).optional() }).parse(req.body.quiz || {});
    const quiz = await storage.updateQuiz(req.params.id, { ...input, questions: input.questions ? JSON.stringify(input.questions) : undefined });
    if (!quiz) return res.status(404).json({ error: "Quiz not found" });
    res.json({ ...quiz, questions: JSON.parse(quiz.questions) });
  });

  app.delete("/api/admin/quizzes/:id", async (req, res) => {
    if (!(await requireAdmin(req.query.userId, res))) return;
    res.json({ deleted: await storage.deleteQuiz(req.params.id) });
  });

  app.post("/api/admin/enrollments", async (req, res) => {
    if (!(await requireAdmin(req.body.instructorId, res))) return;
    const data = z.object({ userId: z.string(), courseId: z.string() }).parse(req.body);
    const course = await storage.getCourse(data.courseId);
    const student = await storage.getUser(data.userId);
    if (!course || !student) return res.status(404).json({ error: "Course or student not found" });
    if (await storage.isUserCourseUnlocked(data.userId, data.courseId)) {
      return res.status(400).json({ error: "Student is already enrolled" });
    }
    res.json(await storage.unlockCourse({ userId: data.userId, courseId: data.courseId }));
  });

  app.delete("/api/admin/enrollments", async (req, res) => {
    if (!(await requireAdmin(req.query.adminId, res))) return;
    const data = z.object({ userId: z.string(), courseId: z.string() }).parse(req.body);
    res.json({ removed: await storage.removeEnrollment(data.userId, data.courseId) });
  });

  app.post("/api/admin/progress/reset", async (req, res) => {
    if (!(await requireAdmin(req.body.adminId, res))) return;
    const data = z.object({ userId: z.string(), courseId: z.string().optional() }).parse(req.body);
    await storage.resetUserProgress(data.userId, data.courseId);
    res.json({ reset: true });
  });

  app.get("/api/admin/analytics", async (req, res) => {
    if (!(await requireAdmin(req.query.userId, res))) return;
    const [courses, users, attempts] = await Promise.all([storage.getAllCourses(), storage.getAllUsers(), storage.getAllQuizAttempts()]);
    const courseStats = await Promise.all(courses.map(async (course) => {
      const modules = await storage.getModulesByCourse(course.id);
      const enrollments = (await Promise.all(users.map((user) => storage.getUserCourses(user.id)))).flat().filter((item) => item.courseId === course.id);
      const completed = (await Promise.all(enrollments.map((item) => storage.getModuleCompletions(item.userId, course.id)))).flat();
      return { id: course.id, title: course.title, enrollments: enrollments.length, completionRate: modules.length && enrollments.length ? Math.round((completed.length / (modules.length * enrollments.length)) * 100) : 0 };
    }));
    res.json({ totalUsers: users.length, totalCourses: courses.length, totalEnrollments: (await Promise.all(users.map((user) => storage.getUserCourses(user.id)))).flat().length, quizAttempts: attempts.length, passedQuizzes: attempts.filter((attempt) => attempt.passed).length, courseStats });
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
      const module = await storage.getModule(data.moduleId);
      if (!module) {
        return res.status(404).json({ error: "Module not found" });
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
      const questions = JSON.parse(quiz.questions) as QuizQuestion[];
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
      
      const questions = JSON.parse(quiz.questions) as QuizQuestion[];
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
      const quiz = await storage.getQuiz(data.quizId);
      if (!quiz) {
        return res.status(404).json({ error: "Quiz not found" });
      }

      const module = await storage.getModule(quiz.moduleId);
      if (!module) return res.status(404).json({ error: "Module not found" });
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
      const passedModuleIds = await storage.getPassedQuizModuleIds(req.params.userId, req.params.courseId);
      res.json({ passedModuleIds: Array.from(passedModuleIds) });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch quiz progress" });
    }
  });

  app.get("/api/dashboard/:userId/leaderboard", async (req, res) => {
    try {
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
      
      const allCourses = await storage.getAllCourses();
      const user = await storage.getUser(userId);
      const isStaff = user ? ["admin", "super_admin", "superadmin", "instructor"].includes(user.role) : false;
      const visibleCourses = allCourses.filter((course) => course.isPublished || isStaff);

      const coursesWithProgress = await Promise.all(
        visibleCourses.map(async (course) => {
          const modules = await storage.getModulesByCourse(course.id);
          const completions = await storage.getModuleCompletions(userId, course.id);
          const completedModules = completions.length;
          const totalModules = modules.length;
          const progress = totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0;

          return {
            ...course,
            isUnlocked: true,
            progress,
            totalModules,
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
