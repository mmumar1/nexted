import dotenv from "dotenv";
import { isSubscriptionActive } from "@shared/payment-plans";
import { createSupabaseAdminClient } from "./supabase-admin.js";
import type { IStorage } from "./storage.js";
import type {
  Course,
  CbtQuestion,
  CbtQuestionFilters,
  CbtQuestionCatalogEntry,
  CbtAttempt,
  InsertCbtAttempt,
  InsertCbtQuestion,
  InsertCourse,
  InsertModule,
  InsertModuleCompletion,
  InsertProject,
  InsertQuiz,
  InsertQuizAttempt,
  InsertUser,
  InsertUserCourse,
  Module,
  ModuleCompletion,
  Project,
  Quiz,
  QuizAttempt,
  User,
  UserCourse,
} from "@shared/schema";

// The server reads the local file during development; production uses platform env vars.
dotenv.config({ path: ".env.local" });

type DatabaseRow = Record<string, any>;

function required<T>(data: T | null, error: { message?: string } | null): T | undefined {
  if (error) throw new Error(error.message || "Supabase request failed");
  return data ?? undefined;
}

function mapProfile(row: DatabaseRow): User {
  return {
    id: row.id,
    email: row.email,
    password: "",
    fullName: row.full_name,
    role: row.role,
    hasActiveSubscription: isSubscriptionActive(row.has_active_subscription, row.subscription_expires_at),
    subscriptionTier: row.subscription_tier,
    subscriptionPaidAt: row.subscription_paid_at ? new Date(row.subscription_paid_at) : null,
    subscriptionExpiresAt: row.subscription_expires_at ? new Date(row.subscription_expires_at) : null,
    state: row.state ?? null,
    localGovernmentArea: row.local_government_area ?? null,
    phoneNumber: row.phone_number ?? null,
    whatsappNumber: row.whatsapp_number ?? null,
    referralCode: row.referral_code ?? null,
  };
}

function mapCourse(row: DatabaseRow): Course {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    accessCode: row.access_code,
    thumbnail: row.thumbnail,
    enrollmentMode: row.enrollment_mode,
    instructorId: row.instructor_id,
    isPublished: row.is_published,
    publishedAt: row.published_at ? new Date(row.published_at) : null,
  };
}

function mapModule(row: DatabaseRow): Module {
  return {
    id: row.id,
    courseId: row.course_id,
    title: row.title,
    order: row.sort_order,
    content: row.content,
    videoUrl: row.video_url,
    videoUrls: Array.isArray(row.video_urls) && row.video_urls.length
      ? row.video_urls
      : row.video_url
        ? [row.video_url]
        : [],
    imageUrl: row.image_url,
    parentModuleId: row.parent_module_id,
    prerequisiteModuleId: row.prerequisite_module_id,
    duration: row.duration_minutes,
  };
}

function mapCompletion(row: DatabaseRow): ModuleCompletion {
  return { id: row.id, userId: row.user_id, moduleId: row.module_id, completedAt: new Date(row.completed_at) };
}

function mapQuiz(row: DatabaseRow): Quiz {
  return {
    id: row.id,
    moduleId: row.module_id,
    title: row.title,
    questions: JSON.stringify(row.questions ?? []),
    passScore: row.pass_score,
  };
}

function mapCbtQuestion(row: DatabaseRow): CbtQuestion {
  if (!Array.isArray(row.options) || !row.options.every((option: unknown) => typeof option === "string")) {
    throw new Error("CBT question has invalid options data");
  }
  return {
    id: row.id,
    subject: row.subject,
    examYear: row.exam_year,
    question: row.question,
    questionImageUrl: row.question_image_url,
    options: row.options,
    correctAnswer: row.correct_answer,
    explanation: row.explanation,
    explanationImageUrl: row.explanation_image_url,
    status: row.status,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    publishedBy: row.published_by,
    publishedAt: row.published_at ? new Date(row.published_at) : null,
    archivedAt: row.archived_at ? new Date(row.archived_at) : null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function mapCbtAttempt(row: DatabaseRow, answers: Record<string, number> = {}): CbtAttempt {
  if (!Array.isArray(row.selections) || !Array.isArray(row.question_snapshot)) {
    throw new Error("CBT attempt has invalid snapshot data");
  }
  return {
    id: row.id,
    userId: row.user_id,
    mode: row.mode,
    selections: row.selections,
    durationMinutes: row.duration_minutes,
    questions: row.question_snapshot,
    answers,
    status: row.status,
    score: row.score,
    startedAt: new Date(row.started_at),
    expiresAt: new Date(row.expires_at),
    submittedAt: row.submitted_at ? new Date(row.submitted_at) : null,
    createdAt: new Date(row.created_at),
  };
}

function mapAttempt(row: DatabaseRow): QuizAttempt {
  return {
    id: row.id,
    userId: row.user_id,
    quizId: row.quiz_id,
    score: row.score,
    totalQuestions: row.total_questions,
    passed: row.passed,
    attemptedAt: new Date(row.attempted_at),
  };
}

function mapProject(row: DatabaseRow): Project {
  return {
    id: row.id,
    userId: row.user_id,
    courseId: row.course_id,
    title: row.title,
    link: row.link,
    description: row.description,
    status: row.status,
    submittedAt: new Date(row.submitted_at),
  };
}

function mapUserCourse(row: DatabaseRow): UserCourse {
  return { id: row.id, userId: row.user_id, courseId: row.course_id, unlockedAt: new Date(row.unlocked_at) };
}

export class SupabaseStorage implements IStorage {
  private readonly client = createSupabaseAdminClient();

  async getUser(id: string) {
    const { data, error } = await this.client.from("profiles").select("*").eq("id", id).maybeSingle();
    return data ? mapProfile(required(data, error)!) : undefined;
  }

  async getUserByEmail(email: string) {
    const { data, error } = await this.client.from("profiles").select("*").ilike("email", email).maybeSingle();
    return data ? mapProfile(required(data, error)!) : undefined;
  }

  async createUser(user: InsertUser) {
    const { data, error } = await this.client.from("profiles").insert({
      email: user.email,
      full_name: user.fullName,
      role: user.role ?? "student",
      has_active_subscription: user.hasActiveSubscription ?? false,
      subscription_tier: user.subscriptionTier ?? "none",
      subscription_paid_at: user.subscriptionPaidAt?.toISOString() ?? null,
      subscription_expires_at: user.subscriptionExpiresAt?.toISOString() ?? null,
      state: user.state ?? null,
      local_government_area: user.localGovernmentArea ?? null,
      phone_number: user.phoneNumber ?? null,
      whatsapp_number: user.whatsappNumber ?? null,
      referral_code: user.referralCode ?? null,
    }).select("*").single();
    return mapProfile(required(data, error)!);
  }

  async updateUser(id: string, update: Partial<Pick<User, "fullName" | "email" | "role">>) {
    const payload: DatabaseRow = {};
    if (update.fullName !== undefined) payload.full_name = update.fullName;
    if (update.email !== undefined) payload.email = update.email;
    if (update.role !== undefined) payload.role = update.role;
    const { data, error } = await this.client.from("profiles").update(payload).eq("id", id).select("*").maybeSingle();
    return data ? mapProfile(required(data, error)!) : undefined;
  }

  async getAllUsers() {
    const { data, error } = await this.client.from("profiles").select("*").order("created_at", { ascending: true });
    return (required(data, error) ?? []).map(mapProfile);
  }

  async getCourse(id: string) {
    const { data, error } = await this.client.from("courses").select("*").eq("id", id).maybeSingle();
    return data ? mapCourse(required(data, error)!) : undefined;
  }

  async getAllCourses() {
    const { data, error } = await this.client.from("courses").select("*").order("created_at", { ascending: true });
    return (required(data, error) ?? []).map(mapCourse);
  }

  async getCourseByAccessCode(accessCode: string) {
    const { data, error } = await this.client.from("courses").select("*").eq("access_code", accessCode).maybeSingle();
    return data ? mapCourse(required(data, error)!) : undefined;
  }

  async createCourse(course: InsertCourse) {
    const { data, error } = await this.client.from("courses").insert({
      title: course.title,
      description: course.description,
      access_code: course.accessCode,
      thumbnail: course.thumbnail ?? null,
      enrollment_mode: course.enrollmentMode ?? "self",
      instructor_id: course.instructorId ?? null,
      is_published: course.isPublished ?? false,
      published_at: course.publishedAt?.toISOString() ?? null,
    }).select("*").single();
    const createdCourse = mapCourse(required(data, error)!);
    if (createdCourse.isPublished) await this.grantCourseToSubscribers(createdCourse.id);
    return createdCourse;
  }

  async updateCourse(id: string, update: Partial<InsertCourse>) {
    const payload: DatabaseRow = {};
    const fields: Array<[keyof InsertCourse, string]> = [
      ["title", "title"], ["description", "description"], ["accessCode", "access_code"],
      ["thumbnail", "thumbnail"], ["enrollmentMode", "enrollment_mode"], ["instructorId", "instructor_id"],
      ["isPublished", "is_published"], ["publishedAt", "published_at"],
    ];
    for (const [source, target] of fields) {
      if (update[source] !== undefined) {
        const value = update[source];
        payload[target] = value instanceof Date ? value.toISOString() : value;
      }
    }
    const { data, error } = await this.client.from("courses").update(payload).eq("id", id).select("*").maybeSingle();
    if (!data) return undefined;
    const updatedCourse = mapCourse(required(data, error)!);
    if (updatedCourse.isPublished) await this.grantCourseToSubscribers(updatedCourse.id);
    return updatedCourse;
  }

  private async grantCourseToSubscribers(courseId: string) {
    const [{ data: subscribers, error: subscriberError }, { data: existing, error: accessError }] = await Promise.all([
      this.client.from("profiles").select("id").eq("has_active_subscription", true),
      this.client.from("user_courses").select("user_id").eq("course_id", courseId),
    ]);
    if (subscriberError || accessError) throw new Error(subscriberError?.message || accessError?.message);
    const existingUsers = new Set((existing ?? []).map((item) => item.user_id));
    const missing = (subscribers ?? []).filter((subscriber) => !existingUsers.has(subscriber.id));
    if (!missing.length) return;
    const { error } = await this.client.from("user_courses").insert(missing.map((subscriber) => ({
      user_id: subscriber.id,
      course_id: courseId,
      access_source: "subscription",
    })));
    if (error) throw new Error(error.message);
  }

  async deleteCourse(id: string) {
    const { error } = await this.client.from("courses").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return true;
  }

  async deleteModule(id: string) {
    const { error } = await this.client.from("modules").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return true;
  }

  async getUserCourses(userId: string) {
    const { data, error } = await this.client.from("user_courses").select("*").eq("user_id", userId);
    return (required(data, error) ?? []).map(mapUserCourse);
  }

  async unlockCourse(data: InsertUserCourse) {
    const { data: row, error } = await this.client.from("user_courses").upsert({ user_id: data.userId, course_id: data.courseId }, { onConflict: "user_id,course_id" }).select("*").single();
    return mapUserCourse(required(row, error)!);
  }

  async isUserCourseUnlocked(userId: string, courseId: string) {
    const { data, error } = await this.client.from("user_courses").select("id").eq("user_id", userId).eq("course_id", courseId).maybeSingle();
    required(data, error);
    return !!data;
  }

  async removeEnrollment(userId: string, courseId: string) {
    const { error } = await this.client.from("user_courses").delete().eq("user_id", userId).eq("course_id", courseId);
    if (error) throw new Error(error.message);
    return true;
  }

  async resetUserProgress(userId: string, courseId?: string) {
    let moduleIds: string[] | undefined;
    if (courseId) moduleIds = (await this.getModulesByCourse(courseId)).map((module) => module.id);
    let completions = this.client.from("module_completions").delete().eq("user_id", userId);
    if (moduleIds?.length) completions = completions.in("module_id", moduleIds);
    const { error: completionError } = await completions;
    if (completionError) throw new Error(completionError.message);
    if (moduleIds?.length) {
      const { data: quizzes, error } = await this.client.from("quizzes").select("id").in("module_id", moduleIds);
      if (error) throw new Error(error.message);
      const { error: attemptError } = await this.client.from("quiz_attempts").delete().eq("user_id", userId).in("quiz_id", (quizzes ?? []).map((quiz) => quiz.id));
      if (attemptError) throw new Error(attemptError.message);
    } else {
      const { error } = await this.client.from("quiz_attempts").delete().eq("user_id", userId);
      if (error) throw new Error(error.message);
    }
  }

  async getModule(id: string) {
    const { data, error } = await this.client.from("modules").select("*").eq("id", id).maybeSingle();
    return data ? mapModule(required(data, error)!) : undefined;
  }

  async getModulesByCourse(courseId: string) {
    const { data, error } = await this.client.from("modules").select("*").eq("course_id", courseId).order("sort_order", { ascending: true });
    return (required(data, error) ?? []).map(mapModule);
  }

  async createModule(module: InsertModule) {
    const { data, error } = await this.client.from("modules").insert({
      course_id: module.courseId,
      title: module.title,
      sort_order: module.order,
      content: module.content,
      video_url: module.videoUrls?.[0] ?? module.videoUrl ?? null,
      video_urls: module.videoUrls ?? (module.videoUrl ? [module.videoUrl] : []),
      image_url: module.imageUrl ?? null,
      parent_module_id: module.parentModuleId ?? null,
      prerequisite_module_id: module.prerequisiteModuleId ?? null,
      duration_minutes: module.duration ?? 30,
    }).select("*").single();
    return mapModule(required(data, error)!);
  }

  async updateModule(id: string, update: Partial<InsertModule>) {
    const payload: DatabaseRow = {};
    const fields: Array<[keyof InsertModule, string]> = [
      ["courseId", "course_id"], ["title", "title"], ["order", "sort_order"], ["content", "content"],
      ["videoUrl", "video_url"], ["videoUrls", "video_urls"], ["imageUrl", "image_url"], ["parentModuleId", "parent_module_id"],
      ["prerequisiteModuleId", "prerequisite_module_id"], ["duration", "duration_minutes"],
    ];
    for (const [source, target] of fields) if (update[source] !== undefined) payload[target] = update[source];
    if (update.videoUrls !== undefined && update.videoUrl === undefined) {
      payload.video_url = update.videoUrls[0] ?? null;
    }
    const { data, error } = await this.client.from("modules").update(payload).eq("id", id).select("*").maybeSingle();
    return data ? mapModule(required(data, error)!) : undefined;
  }

  async getModuleCompletions(userId: string, courseId: string) {
    const modules = await this.getModulesByCourse(courseId);
    const { data, error } = await this.client.from("module_completions").select("*").eq("user_id", userId).in("module_id", modules.map((module) => module.id));
    return (required(data, error) ?? []).map(mapCompletion);
  }

  async getPassedQuizModuleIds(userId: string, courseId: string) {
    const modules = await this.getModulesByCourse(courseId);
    const moduleByQuiz = new Map<string, string>();
    const { data: quizzes, error: quizError } = await this.client.from("quizzes").select("id,module_id").in("module_id", modules.map((module) => module.id));
    if (quizError) throw new Error(quizError.message);
    for (const quiz of quizzes ?? []) moduleByQuiz.set(quiz.id, quiz.module_id);
    const { data: attempts, error } = await this.client.from("quiz_attempts").select("quiz_id").eq("user_id", userId).eq("passed", true).in("quiz_id", Array.from(moduleByQuiz.keys()));
    if (error) throw new Error(error.message);
    return new Set((attempts ?? []).map((attempt) => moduleByQuiz.get(attempt.quiz_id)).filter(Boolean) as string[]);
  }

  async markModuleComplete(data: InsertModuleCompletion) {
    const { data: row, error } = await this.client.from("module_completions").upsert({ user_id: data.userId, module_id: data.moduleId }, { onConflict: "user_id,module_id" }).select("*").single();
    return mapCompletion(required(row, error)!);
  }

  async isModuleCompleted(userId: string, moduleId: string) {
    const { data, error } = await this.client.from("module_completions").select("id").eq("user_id", userId).eq("module_id", moduleId).maybeSingle();
    required(data, error);
    return !!data;
  }

  async getQuiz(id: string) {
    const { data, error } = await this.client.from("quizzes").select("*").eq("id", id).maybeSingle();
    return data ? mapQuiz(required(data, error)!) : undefined;
  }

  async getQuizByModule(moduleId: string) {
    const { data, error } = await this.client.from("quizzes").select("*").eq("module_id", moduleId).maybeSingle();
    return data ? mapQuiz(required(data, error)!) : undefined;
  }

  async createQuiz(quiz: InsertQuiz) {
    const { data, error } = await this.client.from("quizzes").insert({ module_id: quiz.moduleId, title: quiz.title, questions: JSON.parse(quiz.questions), pass_score: quiz.passScore ?? 70 }).select("*").single();
    return mapQuiz(required(data, error)!);
  }

  async getAllQuizzes() {
    const { data, error } = await this.client.from("quizzes").select("*").order("created_at", { ascending: true });
    return (required(data, error) ?? []).map(mapQuiz);
  }

  async updateQuiz(id: string, update: Partial<InsertQuiz>) {
    const payload: DatabaseRow = {};
    if (update.moduleId !== undefined) payload.module_id = update.moduleId;
    if (update.title !== undefined) payload.title = update.title;
    if (update.questions !== undefined) payload.questions = JSON.parse(update.questions);
    if (update.passScore !== undefined) payload.pass_score = update.passScore;
    const { data, error } = await this.client.from("quizzes").update(payload).eq("id", id).select("*").maybeSingle();
    return data ? mapQuiz(required(data, error)!) : undefined;
  }

  async deleteQuiz(id: string) {
    const { error } = await this.client.from("quizzes").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return true;
  }

  async getCbtQuestions(filters: CbtQuestionFilters = {}) {
    let query = this.client.from("cbt_questions").select("*").order("updated_at", { ascending: false }).limit(500);
    if (filters.subject) query = query.ilike("subject", filters.subject);
    if (filters.examYear !== undefined) query = query.eq("exam_year", filters.examYear);
    if (filters.status) query = query.eq("status", filters.status);
    if (filters.createdBy) query = query.eq("created_by", filters.createdBy);
    const { data, error } = await query;
    return (required(data, error) ?? []).map(mapCbtQuestion);
  }

  async getCbtQuestion(id: string) {
    const { data, error } = await this.client.from("cbt_questions").select("*").eq("id", id).maybeSingle();
    return data ? mapCbtQuestion(required(data, error)!) : undefined;
  }

  async createCbtQuestions(questions: InsertCbtQuestion[]) {
    if (!questions.length) return [];
    const { data, error } = await this.client.from("cbt_questions").insert(questions.map((question) => ({
      subject: question.subject,
      exam_year: question.examYear,
      question: question.question,
      question_image_url: question.questionImageUrl ?? null,
      options: question.options,
      correct_answer: question.correctAnswer,
      explanation: question.explanation || null,
      explanation_image_url: question.explanationImageUrl ?? null,
      status: "draft",
      created_by: question.createdBy,
      updated_by: question.createdBy,
    }))).select("*");
    return (required(data, error) ?? []).map(mapCbtQuestion);
  }

  async updateCbtQuestion(id: string, update: Partial<CbtQuestion>) {
    const payload: DatabaseRow = {};
    const fields: Array<[keyof CbtQuestion, string]> = [
      ["subject", "subject"], ["examYear", "exam_year"], ["question", "question"],
      ["questionImageUrl", "question_image_url"], ["options", "options"],
      ["correctAnswer", "correct_answer"], ["explanation", "explanation"],
      ["explanationImageUrl", "explanation_image_url"], ["status", "status"],
      ["updatedBy", "updated_by"], ["publishedBy", "published_by"],
      ["publishedAt", "published_at"], ["archivedAt", "archived_at"],
    ];
    for (const [source, target] of fields) {
      if (update[source] !== undefined) {
        const value = update[source];
        payload[target] = value instanceof Date ? value.toISOString() : value;
      }
    }
    payload.updated_at = new Date().toISOString();
    const { data, error } = await this.client.from("cbt_questions").update(payload).eq("id", id).select("*").maybeSingle();
    return data ? mapCbtQuestion(required(data, error)!) : undefined;
  }

  async getCbtQuestionCatalog(): Promise<CbtQuestionCatalogEntry[]> {
    const grouped = new Map<string, CbtQuestionCatalogEntry>();
    const pageSize = 1000;
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await this.client
        .from("cbt_questions")
        .select("subject, exam_year")
        .eq("status", "published")
        .order("subject")
        .order("exam_year")
        .order("id")
        .range(offset, offset + pageSize - 1);
      const rows = required(data, error) ?? [];
      for (const row of rows) {
        const key = `${String(row.subject).toLowerCase()}\u0000${row.exam_year}`;
        const existing = grouped.get(key);
        if (existing) existing.count += 1;
        else grouped.set(key, { subject: row.subject, examYear: row.exam_year, count: 1 });
      }
      if (rows.length < pageSize) break;
    }
    return Array.from(grouped.values()).sort((a, b) =>
      a.subject.localeCompare(b.subject) || b.examYear - a.examYear,
    );
  }

  async createCbtAttempt(attempt: InsertCbtAttempt): Promise<CbtAttempt> {
    const { data, error } = await this.client.from("cbt_attempts").insert({
      user_id: attempt.userId,
      mode: attempt.mode,
      selections: attempt.selections,
      duration_minutes: attempt.durationMinutes,
      question_snapshot: attempt.questions,
      status: attempt.status,
      started_at: attempt.startedAt.toISOString(),
      expires_at: attempt.expiresAt.toISOString(),
    }).select("*").single();
    return mapCbtAttempt(required(data, error)!);
  }

  async countCbtAttemptsSince(userId: string, since: Date): Promise<number> {
    const { count, error } = await this.client
      .from("cbt_attempts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", since.toISOString());
    if (error) throw new Error(error.message);
    return count ?? 0;
  }

  async getCbtAttempt(id: string): Promise<CbtAttempt | undefined> {
    const { data, error } = await this.client.from("cbt_attempts").select("*").eq("id", id).maybeSingle();
    const row = required(data, error);
    if (!row) return undefined;
    const { data: answerRows, error: answersError } = await this.client
      .from("cbt_attempt_answers")
      .select("question_id, selected_option")
      .eq("attempt_id", id);
    const answers: Record<string, number> = {};
    for (const answer of required(answerRows, answersError) ?? []) {
      answers[answer.question_id] = answer.selected_option;
    }
    return mapCbtAttempt(row, answers);
  }

  async getActiveCbtAttempt(userId: string): Promise<CbtAttempt | undefined> {
    const { data, error } = await this.client
      .from("cbt_attempts")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "in_progress")
      .maybeSingle();
    const row = required(data, error);
    return row ? this.getCbtAttempt(row.id) : undefined;
  }

  async getCbtAttemptsForUser(userId: string): Promise<CbtAttempt[]> {
    const { data, error } = await this.client
      .from("cbt_attempts")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);
    return (required(data, error) ?? []).map((row) => mapCbtAttempt(row));
  }

  async saveCbtAttemptAnswer(
    attemptId: string,
    userId: string,
    questionId: string,
    selectedOption: number | null,
  ): Promise<boolean> {
    const { data, error } = await this.client
      .from("cbt_attempts")
      .select("user_id, status, expires_at, question_snapshot")
      .eq("id", attemptId)
      .maybeSingle();
    const attempt = required(data, error);
    if (
      !attempt
      || attempt.user_id !== userId
      || attempt.status !== "in_progress"
      || new Date(attempt.expires_at).getTime() <= Date.now()
      || !Array.isArray(attempt.question_snapshot)
      || !attempt.question_snapshot.some((question: DatabaseRow) => question.id === questionId)
    ) return false;

    if (selectedOption === null) {
      const { error } = await this.client
        .from("cbt_attempt_answers")
        .delete()
        .eq("attempt_id", attemptId)
        .eq("question_id", questionId);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await this.client.from("cbt_attempt_answers").upsert({
        attempt_id: attemptId,
        question_id: questionId,
        selected_option: selectedOption,
        answered_at: new Date().toISOString(),
      });
      if (error) throw new Error(error.message);
    }
    return true;
  }

  async finishCbtAttempt(
    id: string,
    update: Pick<CbtAttempt, "status" | "score" | "submittedAt">,
  ): Promise<CbtAttempt | undefined> {
    const payload: DatabaseRow = {};
    payload.status = update.status;
    payload.score = update.score;
    payload.submitted_at = update.submittedAt?.toISOString() ?? null;
    const { data, error } = await this.client
      .from("cbt_attempts")
      .update(payload)
      .eq("id", id)
      .eq("status", "in_progress")
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? this.getCbtAttempt(id) : undefined;
  }

  async getQuizAttempts(userId: string, quizId: string) {
    const { data, error } = await this.client.from("quiz_attempts").select("*").eq("user_id", userId).eq("quiz_id", quizId).order("attempted_at", { ascending: false });
    return (required(data, error) ?? []).map(mapAttempt);
  }

  async createQuizAttempt(attempt: InsertQuizAttempt) {
    const { data, error } = await this.client.from("quiz_attempts").insert({ user_id: attempt.userId, quiz_id: attempt.quizId, score: attempt.score, total_questions: attempt.totalQuestions, passed: attempt.passed ?? false }).select("*").single();
    return mapAttempt(required(data, error)!);
  }

  async getAllQuizAttempts() {
    const { data, error } = await this.client.from("quiz_attempts").select("*");
    return (required(data, error) ?? []).map(mapAttempt);
  }

  async getProject(id: string) {
    const { data, error } = await this.client.from("projects").select("*").eq("id", id).maybeSingle();
    return data ? mapProject(required(data, error)!) : undefined;
  }

  async getUserProjects(userId: string) {
    const { data, error } = await this.client.from("projects").select("*").eq("user_id", userId).order("submitted_at", { ascending: false });
    return (required(data, error) ?? []).map(mapProject);
  }

  async createProject(project: InsertProject) {
    const { data, error } = await this.client.from("projects").insert({ user_id: project.userId, course_id: project.courseId, title: project.title, link: project.link, description: project.description, status: project.status ?? "pending" }).select("*").single();
    return mapProject(required(data, error)!);
  }
}
