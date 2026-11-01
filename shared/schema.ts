import { sql } from "drizzle-orm";
import { pgTable, text, varchar, boolean, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { isNigerianLga, isNigerianState } from "./nigeria-locations.js";

// Users table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  role: text("role").notNull().default("student"),
  hasActiveSubscription: boolean("has_active_subscription").notNull().default(false),
  subscriptionTier: text("subscription_tier").notNull().default("none"),
  subscriptionPaidAt: timestamp("subscription_paid_at"),
  subscriptionExpiresAt: timestamp("subscription_expires_at"),
  state: text("state"),
  localGovernmentArea: text("local_government_area"),
  phoneNumber: text("phone_number"),
  whatsappNumber: text("whatsapp_number"),
  referralCode: text("referral_code"),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const registerSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name"),
  email: z.string().trim().email("Please enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  state: z.string().min(1, "Choose your state"),
  localGovernmentArea: z.string().min(1, "Choose your local government area"),
  phoneNumber: z.string().trim().regex(/^\+?[0-9][0-9\s().-]{6,19}$/, "Enter a valid phone number"),
  whatsappNumber: z.string().trim().refine(
    (value) => value === "" || /^\+?[0-9][0-9\s().-]{6,19}$/.test(value),
    "Enter a valid WhatsApp number",
  ),
  referralCode: z.string().trim().max(80, "Referral code must be 80 characters or fewer"),
}).superRefine((data, context) => {
  if (!isNigerianState(data.state)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["state"],
      message: "Choose a valid Nigerian state",
    });
  } else if (!isNigerianLga(data.state, data.localGovernmentArea)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["localGovernmentArea"],
      message: "Choose a local government area in the selected state",
    });
  }
});

export type RegisterData = z.infer<typeof registerSchema>;

// Courses table
export const courses = pgTable("courses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description").notNull(),
  accessCode: text("access_code").notNull(),
  thumbnail: text("thumbnail"),
  enrollmentMode: text("enrollment_mode").notNull().default("self"),
  instructorId: varchar("instructor_id"),
  isPublished: boolean("is_published").notNull().default(false),
  publishedAt: timestamp("published_at"),
});

export const insertCourseSchema = createInsertSchema(courses).omit({ id: true });
export type InsertCourse = z.infer<typeof insertCourseSchema>;
export type Course = typeof courses.$inferSelect;

// User course access table (many-to-many)
export const userCourses = pgTable("user_courses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  courseId: varchar("course_id").notNull(),
  unlockedAt: timestamp("unlocked_at").notNull().defaultNow(),
});

export const insertUserCourseSchema = createInsertSchema(userCourses).omit({ id: true, unlockedAt: true });
export type InsertUserCourse = z.infer<typeof insertUserCourseSchema>;
export type UserCourse = typeof userCourses.$inferSelect;

// Modules table
export const modules = pgTable("modules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  courseId: varchar("course_id").notNull(),
  title: text("title").notNull(),
  order: integer("order").notNull(),
  content: text("content").notNull(),
  videoUrl: text("video_url"),
  videoUrls: text("video_urls").array().notNull().default(sql`'{}'::text[]`),
  imageUrl: text("image_url"),
  parentModuleId: varchar("parent_module_id"),
  prerequisiteModuleId: varchar("prerequisite_module_id"),
  duration: integer("duration").notNull().default(30),
});

export const httpImageUrlSchema = z.string().url().refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === "http:" || protocol === "https:";
}, "Images must use an HTTP or HTTPS URL");

const youtubeVideoUrlSchema = z.string().trim().url().refine((value) => {
  const url = new URL(value);
  const youtubeHosts = [
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "youtu.be",
    "www.youtu.be",
    "youtube-nocookie.com",
    "www.youtube-nocookie.com",
  ];
  return youtubeHosts.includes(url.hostname.toLowerCase())
    && (url.protocol === "http:" || url.protocol === "https:");
}, "Enter a valid YouTube video URL");

export const insertModuleSchema = createInsertSchema(modules)
  .omit({ id: true })
  .extend({
    imageUrl: httpImageUrlSchema.nullable().optional(),
    videoUrls: z.array(youtubeVideoUrlSchema).optional(),
  });
export type InsertModule = z.infer<typeof insertModuleSchema>;
export type Module = typeof modules.$inferSelect;

// Module completion tracking
export const moduleCompletions = pgTable("module_completions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  moduleId: varchar("module_id").notNull(),
  completedAt: timestamp("completed_at").notNull().defaultNow(),
});

export const insertModuleCompletionSchema = createInsertSchema(moduleCompletions).omit({ id: true, completedAt: true });
export type InsertModuleCompletion = z.infer<typeof insertModuleCompletionSchema>;
export type ModuleCompletion = typeof moduleCompletions.$inferSelect;

// Quizzes table
export const quizzes = pgTable("quizzes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  moduleId: varchar("module_id").notNull(),
  title: text("title").notNull(),
  questions: text("questions").notNull(), // JSON string of questions array
  passScore: integer("pass_score").notNull().default(70),
});

export const insertQuizSchema = createInsertSchema(quizzes).omit({ id: true });
export type InsertQuiz = z.infer<typeof insertQuizSchema>;
export type Quiz = typeof quizzes.$inferSelect;

// Quiz question type (not stored in DB, used in questions JSON)
export const quizQuestionImageUrlSchema = httpImageUrlSchema;

export const quizQuestionSchema = z.object({
  id: z.string(),
  question: z.string().min(1),
  questionImageUrl: quizQuestionImageUrlSchema.optional(),
  options: z.array(z.string()).length(4),
  correctAnswer: z.number().int().min(1).max(4),
  correctAnswerBase: z.literal(1).optional(),
  explanation: z.string().optional(),
  explanationImageUrl: quizQuestionImageUrlSchema.optional(),
});

export type QuizQuestion = z.infer<typeof quizQuestionSchema>;

export const cbtQuestionStatusSchema = z.enum(["draft", "published", "archived"]);
export type CbtQuestionStatus = z.infer<typeof cbtQuestionStatusSchema>;

export const cbtQuestionInputSchema = z.object({
  subject: z.string().trim().min(1).max(80),
  examYear: z.number().int().min(1950).max(2100),
  question: z.string().trim().min(1).max(10000),
  questionImageUrl: quizQuestionImageUrlSchema.optional(),
  options: z.array(z.string().trim().min(1).max(2000)).length(4),
  correctAnswer: z.number().int().min(1).max(4),
  explanation: z.string().trim().max(10000).optional(),
  explanationImageUrl: quizQuestionImageUrlSchema.optional(),
});

export type CbtQuestionInput = z.infer<typeof cbtQuestionInputSchema>;

export type CbtQuestion = Omit<CbtQuestionInput, "questionImageUrl" | "explanation" | "explanationImageUrl"> & {
  id: string;
  questionImageUrl: string | null;
  explanation: string | null;
  explanationImageUrl: string | null;
  status: CbtQuestionStatus;
  createdBy: string;
  updatedBy: string;
  publishedBy: string | null;
  publishedAt: Date | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type InsertCbtQuestion = CbtQuestionInput & { createdBy: string };

export interface CbtQuestionFilters {
  subject?: string;
  examYear?: number;
  status?: CbtQuestionStatus;
  createdBy?: string;
}

export interface CbtQuestionCatalogEntry {
  subject: string;
  examYear: number;
  count: number;
}

export type CbtAttemptMode = "self" | "mock";
export type CbtAttemptStatus = "in_progress" | "submitted" | "expired";

export interface CbtAttemptSelection {
  subject: string;
  examYear: number;
  questionCount: number;
}

export interface CbtAttemptQuestion {
  id: string;
  subject: string;
  examYear: number;
  question: string;
  questionImageUrl: string | null;
  options: string[];
  correctAnswer: number;
  explanation: string | null;
  explanationImageUrl: string | null;
}

export interface CbtAttempt {
  id: string;
  userId: string;
  mode: CbtAttemptMode;
  selections: CbtAttemptSelection[];
  durationMinutes: number;
  questions: CbtAttemptQuestion[];
  answers: Record<string, number>;
  status: CbtAttemptStatus;
  score: number | null;
  startedAt: Date;
  expiresAt: Date;
  submittedAt: Date | null;
  createdAt: Date;
}

export type InsertCbtAttempt = Omit<CbtAttempt, "id" | "answers" | "score" | "submittedAt" | "createdAt">;

export const cbtQuestions = pgTable("cbt_questions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  subject: text("subject").notNull(),
  examYear: integer("exam_year").notNull(),
  question: text("question").notNull(),
  questionImageUrl: text("question_image_url"),
  options: jsonb("options").$type<string[]>().notNull(),
  correctAnswer: integer("correct_answer").notNull(),
  explanation: text("explanation"),
  explanationImageUrl: text("explanation_image_url"),
  status: text("status").notNull().default("draft"),
  createdBy: varchar("created_by").notNull(),
  updatedBy: varchar("updated_by").notNull(),
  publishedBy: varchar("published_by"),
  publishedAt: timestamp("published_at"),
  archivedAt: timestamp("archived_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const cbtAttempts = pgTable("cbt_attempts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  mode: text("mode").notNull(),
  selections: jsonb("selections").$type<CbtAttemptSelection[]>().notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  questions: jsonb("question_snapshot").$type<CbtAttemptQuestion[]>().notNull(),
  status: text("status").notNull().default("in_progress"),
  score: integer("score"),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
  submittedAt: timestamp("submitted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const cbtAttemptAnswers = pgTable("cbt_attempt_answers", {
  attemptId: varchar("attempt_id").notNull(),
  questionId: varchar("question_id").notNull(),
  selectedOption: integer("selected_option").notNull(),
  answeredAt: timestamp("answered_at").notNull().defaultNow(),
});

export const events = pgTable("events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  timezone: text("timezone").notNull(),
  location: text("location"),
  meetingUrl: text("meeting_url"),
  status: text("status").notNull().default("draft"),
  revision: integer("revision").notNull().default(0),
  authorId: varchar("author_id").notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type EventStatus = "draft" | "published" | "cancelled";
export type EventRsvpStatus = "attending" | "not_attending";

export interface EventRecord {
  id: string;
  title: string;
  description: string;
  startsAt: Date;
  endsAt: Date;
  timezone: string;
  location: string | null;
  meetingUrl: string | null;
  status: EventStatus;
  revision: number;
  authorId: string;
  authorName: string;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  rsvpCount: number;
  rsvpStatus: EventRsvpStatus | null;
}

export interface EventNotification {
  id: string;
  eventId: string;
  revision: number;
  title: string;
  startsAt: Date;
  status: EventStatus;
  createdAt: Date;
  readAt: Date | null;
}

export interface EventInput {
  title: string;
  description: string;
  startsAt: Date;
  endsAt: Date;
  timezone: string;
  location?: string;
  meetingUrl?: string;
}

export interface EventFilters {
  authorId?: string;
}

export interface EventRsvp {
  eventId: string;
  studentId: string;
  status: EventRsvpStatus;
  updatedAt: Date;
}

// Quiz attempts table
export const quizAttempts = pgTable("quiz_attempts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  quizId: varchar("quiz_id").notNull(),
  score: integer("score").notNull(),
  totalQuestions: integer("total_questions").notNull(),
  passed: boolean("passed").notNull().default(false),
  attemptedAt: timestamp("attempted_at").notNull().defaultNow(),
});

export const insertQuizAttemptSchema = createInsertSchema(quizAttempts).omit({ id: true, attemptedAt: true });
export type InsertQuizAttempt = z.infer<typeof insertQuizAttemptSchema>;
export type QuizAttempt = typeof quizAttempts.$inferSelect;

// Projects table
export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  courseId: varchar("course_id").notNull(),
  title: text("title").notNull(),
  link: text("link").notNull(),
  description: text("description").notNull(),
  status: text("status").notNull().default("pending"),
  submittedAt: timestamp("submitted_at").notNull().defaultNow(),
});

export const insertProjectSchema = createInsertSchema(projects).omit({ id: true, submittedAt: true });
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;

// Login schema
export const loginSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export type LoginData = z.infer<typeof loginSchema>;

// Unlock course schema
export const unlockCourseSchema = z.object({
  courseId: z.string(),
  accessCode: z.string().min(1, "Access code is required"),
});

export type UnlockCourseData = z.infer<typeof unlockCourseSchema>;
