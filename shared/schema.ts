import { sql } from "drizzle-orm";
import { pgTable, text, varchar, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

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
  imageUrl: text("image_url"),
  parentModuleId: varchar("parent_module_id"),
  prerequisiteModuleId: varchar("prerequisite_module_id"),
  duration: integer("duration").notNull().default(30),
});

export const insertModuleSchema = createInsertSchema(modules).omit({ id: true });
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
export const quizQuestionSchema = z.object({
  id: z.string(),
  question: z.string(),
  options: z.array(z.string()),
  correctAnswer: z.number(),
  correctAnswerBase: z.literal(1).optional(),
  explanation: z.string().optional(),
});

export type QuizQuestion = z.infer<typeof quizQuestionSchema>;

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
