import dotenv from "dotenv";
import { createSupabaseAdminClient } from "./supabase-admin";
import type { IStorage } from "./storage";
import type {
  Course,
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
    hasActiveSubscription: row.has_active_subscription,
    subscriptionTier: row.subscription_tier,
    subscriptionPaidAt: row.subscription_paid_at ? new Date(row.subscription_paid_at) : null,
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
      video_url: module.videoUrl ?? null,
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
      ["videoUrl", "video_url"], ["imageUrl", "image_url"], ["parentModuleId", "parent_module_id"],
      ["prerequisiteModuleId", "prerequisite_module_id"], ["duration", "duration_minutes"],
    ];
    for (const [source, target] of fields) if (update[source] !== undefined) payload[target] = update[source];
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
