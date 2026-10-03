import {
  type User,
  type InsertUser,
  type Course,
  type InsertCourse,
  type UserCourse,
  type InsertUserCourse,
  type Module,
  type InsertModule,
  type ModuleCompletion,
  type InsertModuleCompletion,
  type Quiz,
  type InsertQuiz,
  type QuizAttempt,
  type InsertQuizAttempt,
  type Project,
  type InsertProject,
} from "../shared/schema.js";
import { randomUUID } from "crypto";
import { SupabaseStorage } from "./supabase-storage.js";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, data: Partial<Pick<User, "fullName" | "email" | "role">>): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;

  // Courses
  getCourse(id: string): Promise<Course | undefined>;
  getAllCourses(): Promise<Course[]>;
  getCourseByAccessCode(accessCode: string): Promise<Course | undefined>;
  createCourse(course: InsertCourse): Promise<Course>;
  updateCourse(id: string, data: Partial<InsertCourse>): Promise<Course | undefined>;
  deleteCourse(id: string): Promise<boolean>;
  deleteModule(id: string): Promise<boolean>;

  // User Courses (unlocked courses)
  getUserCourses(userId: string): Promise<UserCourse[]>;
  unlockCourse(data: InsertUserCourse): Promise<UserCourse>;
  isUserCourseUnlocked(userId: string, courseId: string): Promise<boolean>;
  removeEnrollment(userId: string, courseId: string): Promise<boolean>;
  resetUserProgress(userId: string, courseId?: string): Promise<void>;

  // Modules
  getModule(id: string): Promise<Module | undefined>;
  getModulesByCourse(courseId: string): Promise<Module[]>;
  createModule(module: InsertModule): Promise<Module>;
  updateModule(id: string, data: Partial<InsertModule>): Promise<Module | undefined>;

  // Module Completions
  getModuleCompletions(userId: string, courseId: string): Promise<ModuleCompletion[]>;
  getPassedQuizModuleIds(userId: string, courseId: string): Promise<Set<string>>;
  markModuleComplete(data: InsertModuleCompletion): Promise<ModuleCompletion>;
  isModuleCompleted(userId: string, moduleId: string): Promise<boolean>;

  // Quizzes
  getQuiz(id: string): Promise<Quiz | undefined>;
  getQuizByModule(moduleId: string): Promise<Quiz | undefined>;
  createQuiz(quiz: InsertQuiz): Promise<Quiz>;
  getAllQuizzes(): Promise<Quiz[]>;
  updateQuiz(id: string, data: Partial<InsertQuiz>): Promise<Quiz | undefined>;
  deleteQuiz(id: string): Promise<boolean>;

  // Quiz Attempts
  getQuizAttempts(userId: string, quizId: string): Promise<QuizAttempt[]>;
  createQuizAttempt(attempt: InsertQuizAttempt): Promise<QuizAttempt>;
  getAllQuizAttempts(): Promise<QuizAttempt[]>;

  // Projects
  getProject(id: string): Promise<Project | undefined>;
  getUserProjects(userId: string): Promise<Project[]>;
  createProject(project: InsertProject): Promise<Project>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private courses: Map<string, Course>;
  private userCourses: Map<string, UserCourse>;
  private modules: Map<string, Module>;
  private moduleCompletions: Map<string, ModuleCompletion>;
  private quizzes: Map<string, Quiz>;
  private quizAttempts: Map<string, QuizAttempt>;
  private projects: Map<string, Project>;

  constructor() {
    this.users = new Map();
    this.courses = new Map();
    this.userCourses = new Map();
    this.modules = new Map();
    this.moduleCompletions = new Map();
    this.quizzes = new Map();
    this.quizAttempts = new Map();
    this.projects = new Map();

    this.users.set("admin-local", {
      id: "admin-local",
      email: "admin@learnpedia.academy",
      password: "admin123",
      fullName: "Learnpedia Administrator",
      role: "admin",
      hasActiveSubscription: false,
      subscriptionTier: "none",
      subscriptionPaidAt: null,
    });

    this.users.set("student-demo", {
      id: "student-demo",
      email: "student@learnpedia.academy",
      password: "student123",
      fullName: "Student Demo User",
      role: "student",
      hasActiveSubscription: false,
      subscriptionTier: "none",
      subscriptionPaidAt: null,
    });

    this.users.set("subscriber-demo", {
      id: "subscriber-demo",
      email: "subscriber@learnpedia.academy",
      password: "subscriber123",
      fullName: "Premium Subscriber",
      role: "student",
      hasActiveSubscription: true,
      subscriptionTier: "one-time",
      subscriptionPaidAt: new Date(),
    });
    
    // Seed initial data
    this.seedData();
  }

  private seedData() {
    // Create demo courses
    const course1: Course = {
      id: "1",
      title: "Bio 1101-1",
      description: "An introductory course to college biology for nursing students",
      accessCode: "Bio101",
      thumbnail: "https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=1200&q=80",
      enrollmentMode: "self",
      instructorId: null,
      isPublished: true,
      publishedAt: new Date(),
    };
    
    const course2: Course = {
      id: "2",
      title: "Chem-1102-1",
      description: "Explore the fascinating world of science and Chemistry",
      accessCode: "SCI101",
      thumbnail: "https://images.unsplash.com/photo-1532187643603-ba119ca4109e?auto=format&fit=crop&w=1200&q=80",
      enrollmentMode: "restricted",
      instructorId: null,
      isPublished: true,
      publishedAt: new Date(),
    };
    
    const course3: Course = {
      id: "3",
      title: "Digital Information Systems Mastery",
      description: "Learn modern information systems for record keeping and analytics",
      accessCode: "DIS101",
      thumbnail: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80",
      enrollmentMode: "self",
      instructorId: null,
      isPublished: true,
      publishedAt: new Date(),
    };

    this.courses.set(course1.id, course1);
    this.courses.set(course2.id, course2);
    this.courses.set(course3.id, course3);

    // Create modules for course 1
    const modules = [
      {
        id: "1",
        courseId: "1",
        title: "Introduction to Web Development",
        order: 1,
        content: `<h3 class="text-xl font-semibold mb-4">Welcome to Web Development!</h3><p class="mb-4">Web development is the process of building websites and web applications. In this module, you'll learn the fundamental concepts that every web developer needs to know.</p><h4 class="text-lg font-semibold mb-2 mt-6">What You'll Learn:</h4><ul class="list-disc pl-6 space-y-2 mb-4"><li>Understanding the structure of the web</li><li>Client-server architecture</li><li>The role of HTML, CSS, and JavaScript</li><li>Modern web development tools</li></ul><p>By the end of this module, you'll have a solid foundation to begin your journey into web development.</p>`,
        videoUrl: "https://youtu.be/oh4L2gcI5ds?si=Wc76Viv-P3dODMAG",
        imageUrl: null,
        parentModuleId: null,
        prerequisiteModuleId: null,
        duration: 25,
      },
      {
        id: "2",
        courseId: "1",
        title: "HTML Basics",
        order: 1,
        content: `<h3 class="text-xl font-semibold mb-4">HTML: The Structure of the Web</h3><p class="mb-4">HTML (HyperText Markup Language) is the foundation of every web page. It provides the structure and semantic meaning to web content.</p><h4 class="text-lg font-semibold mb-2 mt-6">Key Concepts:</h4><ul class="list-disc pl-6 space-y-2 mb-4"><li>Elements and Tags</li><li>Attributes and Values</li><li>Semantic HTML</li><li>Forms and Input Elements</li></ul><div class="bg-muted p-4 rounded-md my-4 font-mono text-sm">&lt;div class="container"&gt;<br/>&nbsp;&nbsp;&lt;h1&gt;Hello World&lt;/h1&gt;<br/>&nbsp;&nbsp;&lt;p&gt;This is a paragraph.&lt;/p&gt;<br/>&lt;/div&gt;</div>`,
        videoUrl: null,
        imageUrl: null,
        parentModuleId: "1",
        prerequisiteModuleId: null,
        duration: 30,
      },
      {
        id: "3",
        courseId: "1",
        title: "CSS Styling",
        order: 2,
        content: `<h3 class="text-xl font-semibold mb-4">CSS: Making the Web Beautiful</h3><p class="mb-4">CSS (Cascading Style Sheets) controls the visual presentation of HTML elements. Learn how to create stunning, responsive designs.</p><h4 class="text-lg font-semibold mb-2 mt-6">Topics Covered:</h4><ul class="list-disc pl-6 space-y-2 mb-4"><li>Selectors and Specificity</li><li>Box Model</li><li>Flexbox and Grid</li><li>Responsive Design</li><li>Animations and Transitions</li></ul>`,
        videoUrl: null,
        imageUrl: null,
        parentModuleId: "1",
        prerequisiteModuleId: "2",
        duration: 35,
      },
      {
        id: "4",
        courseId: "1",
        title: "JavaScript Fundamentals",
        order: 3,
        content: `<h3 class="text-xl font-semibold mb-4">JavaScript: Adding Interactivity</h3><p class="mb-4">JavaScript brings your websites to life with dynamic, interactive features. Master the fundamentals of programming for the web.</p><h4 class="text-lg font-semibold mb-2 mt-6">Learning Objectives:</h4><ul class="list-disc pl-6 space-y-2 mb-4"><li>Variables and Data Types</li><li>Functions and Scope</li><li>DOM Manipulation</li><li>Events and Event Handling</li><li>Asynchronous Programming</li></ul>`,
        videoUrl: null,
        imageUrl: null,
        parentModuleId: "1",
        prerequisiteModuleId: "3",
        duration: 40,
      },
      {
        id: "5",
        courseId: "1",
        title: "Deploying and Hosting",
        order: 2,
        content: `<h3 class="text-xl font-semibold mb-4">Deploying and Hosting</h3><p class="mb-4">Once your website is built, you need to publish it so the world can access it. This module covers hosting strategies and basic deployment workflows.</p><ul class="list-disc pl-6 space-y-2 mb-4"><li>Static hosting</li><li>GitHub Pages</li><li>Domain configuration</li><li>Environment setup</li></ul>`,
        videoUrl: null,
        imageUrl: null,
        parentModuleId: null,
        prerequisiteModuleId: "4",
        duration: 28,
      },
      {
        id: "6",
        courseId: "1",
        title: "Project Workflow",
        order: 3,
        content: `<h3 class="text-xl font-semibold mb-4">Project Workflow</h3><p class="mb-4">Real-world projects require planning, iteration, and collaboration. Learn how to manage a web project from idea to completion.</p><ul class="list-disc pl-6 space-y-2 mb-4"><li>Planning and requirements</li><li>Design handoff</li><li>Testing and debugging</li><li>Version control basics</li></ul>`,
        videoUrl: null,
        imageUrl: null,
        parentModuleId: null,
        prerequisiteModuleId: "5",
        duration: 22,
      },
      {
        id: "7",
        courseId: "1",
        title: "Capstone Challenge",
        order: 4,
        content: `<h3 class="text-xl font-semibold mb-4">Capstone Challenge</h3><p class="mb-4">Apply everything you've learned in a mini capstone project. Build a polished webpage using the techniques from earlier modules.</p><ul class="list-disc pl-6 space-y-2 mb-4"><li>Wireframe and plan</li><li>Build the interface</li><li>Debug and refine</li><li>Publish the final result</li></ul>`,
        videoUrl: null,
        imageUrl: null,
        parentModuleId: null,
        prerequisiteModuleId: "6",
        duration: 45,
      },
    ];

    modules.forEach(m => this.modules.set(m.id, m as Module));

    // Create quizzes for each module
    const quiz1: Quiz = {
      id: "1",
      moduleId: "1",
      title: "Introduction Quiz",
      passScore: 70,
      questions: JSON.stringify([
        {
          id: "1",
          question: "What does HTML stand for?",
          options: [
            "Hyper Text Markup Language",
            "High Tech Modern Language",
            "Home Tool Markup Language",
            "Hyperlinks and Text Markup Language",
          ],
          correctAnswer: 0,
        },
        {
          id: "2",
          question: "Which technology is primarily responsible for styling web pages?",
          options: ["HTML", "CSS", "JavaScript", "Python"],
          correctAnswer: 1,
        },
        {
          id: "3",
          question: "What is JavaScript used for in web development?",
          options: [
            "Styling web pages",
            "Structuring web pages",
            "Adding interactivity",
            "Database management",
          ],
          correctAnswer: 2,
        },
      ]),
    };

    const quiz2: Quiz = {
      id: "2",
      moduleId: "2",
      title: "HTML Basics Quiz",
      passScore: 70,
      questions: JSON.stringify([
        {
          id: "1",
          question: "Which HTML tag is used for the largest heading?",
          options: ["<heading>", "<h6>", "<h1>", "<head>"],
          correctAnswer: 2,
        },
        {
          id: "2",
          question: "What is the correct HTML element for inserting a line break?",
          options: ["<break>", "<lb>", "<br>", "<newline>"],
          correctAnswer: 2,
        },
        {
          id: "3",
          question: "Which attribute is used to provide alternative text for an image?",
          options: ["title", "alt", "src", "description"],
          correctAnswer: 1,
        },
      ]),
    };

    this.quizzes.set(quiz1.id, quiz1);
    this.quizzes.set(quiz2.id, quiz2);
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = {
      ...insertUser,
      id,
      role: insertUser.role ?? "student",
      hasActiveSubscription: insertUser.hasActiveSubscription ?? false,
      subscriptionTier: insertUser.subscriptionTier ?? "none",
      subscriptionPaidAt: insertUser.subscriptionPaidAt ?? null,
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: string, data: Partial<Pick<User, "fullName" | "email" | "role">>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    const updated = { ...user, ...data };
    this.users.set(id, updated);
    return updated;
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  // Courses
  async getCourse(id: string): Promise<Course | undefined> {
    return this.courses.get(id);
  }

  async getAllCourses(): Promise<Course[]> {
    return Array.from(this.courses.values());
  }

  async getCourseByAccessCode(accessCode: string): Promise<Course | undefined> {
    return Array.from(this.courses.values()).find(
      (course) => course.accessCode === accessCode,
    );
  }

  async createCourse(insertCourse: InsertCourse): Promise<Course> {
    const id = randomUUID();
    const course: Course = {
      ...insertCourse,
      id,
      thumbnail: insertCourse.thumbnail ?? null,
      enrollmentMode: insertCourse.enrollmentMode ?? "self",
      instructorId: insertCourse.instructorId ?? null,
      isPublished: insertCourse.isPublished ?? false,
      publishedAt: insertCourse.publishedAt ?? null,
    };
    this.courses.set(id, course);
    return course;
  }

  async updateCourse(id: string, data: Partial<InsertCourse>): Promise<Course | undefined> {
    const course = this.courses.get(id);
    if (!course) return undefined;
    const updated: Course = {
      ...course,
      ...data,
      thumbnail: data.thumbnail ?? course.thumbnail,
      enrollmentMode: data.enrollmentMode ?? course.enrollmentMode,
      instructorId: data.instructorId ?? course.instructorId,
      isPublished: data.isPublished ?? course.isPublished,
      publishedAt: data.publishedAt ?? course.publishedAt,
    };
    this.courses.set(id, updated);
    return updated;
  }

  async deleteCourse(id: string): Promise<boolean> {
    return this.courses.delete(id);
  }

  async deleteModule(id: string): Promise<boolean> {
    return this.modules.delete(id);
  }

  // User Courses
  async getUserCourses(userId: string): Promise<UserCourse[]> {
    return Array.from(this.userCourses.values()).filter(
      (uc) => uc.userId === userId,
    );
  }

  async unlockCourse(data: InsertUserCourse): Promise<UserCourse> {
    const id = randomUUID();
    const userCourse: UserCourse = { ...data, id, unlockedAt: new Date() };
    this.userCourses.set(id, userCourse);
    return userCourse;
  }

  async isUserCourseUnlocked(userId: string, courseId: string): Promise<boolean> {
    return Array.from(this.userCourses.values()).some(
      (uc) => uc.userId === userId && uc.courseId === courseId,
    );
  }

  async removeEnrollment(userId: string, courseId: string): Promise<boolean> {
    const enrollment = Array.from(this.userCourses.entries()).find(([, item]) => item.userId === userId && item.courseId === courseId);
    return enrollment ? this.userCourses.delete(enrollment[0]) : false;
  }

  async resetUserProgress(userId: string, courseId?: string): Promise<void> {
    const moduleIds = courseId ? new Set((await this.getModulesByCourse(courseId)).map((module) => module.id)) : undefined;
    for (const [id, completion] of Array.from(this.moduleCompletions.entries())) {
      if (completion.userId === userId && (!moduleIds || moduleIds.has(completion.moduleId))) this.moduleCompletions.delete(id);
    }
    for (const [id, attempt] of Array.from(this.quizAttempts.entries())) {
      if (attempt.userId === userId && (!courseId || (await this.getQuiz(attempt.quizId)) && moduleIds?.has((await this.getQuiz(attempt.quizId))!.moduleId))) this.quizAttempts.delete(id);
    }
  }

  // Modules
  async getModule(id: string): Promise<Module | undefined> {
    return this.modules.get(id);
  }

  async getModulesByCourse(courseId: string): Promise<Module[]> {
    return Array.from(this.modules.values())
      .filter((m) => m.courseId === courseId)
      .sort((a, b) => a.order - b.order);
  }

  async createModule(insertModule: InsertModule): Promise<Module> {
    const id = randomUUID();
    const module: Module = {
      ...insertModule,
      id,
      videoUrl: insertModule.videoUrl ?? null,
      imageUrl: insertModule.imageUrl ?? null,
      parentModuleId: insertModule.parentModuleId ?? null,
      prerequisiteModuleId: insertModule.prerequisiteModuleId ?? null,
      duration: insertModule.duration ?? 30,
    };
    this.modules.set(id, module);
    return module;
  }

  async updateModule(id: string, data: Partial<InsertModule>): Promise<Module | undefined> {
    const module = this.modules.get(id);
    if (!module) return undefined;
    const updated: Module = { ...module, ...data, videoUrl: data.videoUrl ?? module.videoUrl, imageUrl: data.imageUrl ?? module.imageUrl, parentModuleId: data.parentModuleId ?? module.parentModuleId, prerequisiteModuleId: data.prerequisiteModuleId ?? module.prerequisiteModuleId, duration: data.duration ?? module.duration };
    this.modules.set(id, updated);
    return updated;
  }

  // Module Completions
  async getModuleCompletions(userId: string, courseId: string): Promise<ModuleCompletion[]> {
    const courseModules = await this.getModulesByCourse(courseId);
    const moduleIds = new Set(courseModules.map((m) => m.id));
    
    return Array.from(this.moduleCompletions.values()).filter(
      (mc) => mc.userId === userId && moduleIds.has(mc.moduleId),
    );
  }

  async getPassedQuizModuleIds(userId: string, courseId: string): Promise<Set<string>> {
    const courseModuleIds = new Set((await this.getModulesByCourse(courseId)).map((module) => module.id));
    const passedQuizIds = new Set(
      Array.from(this.quizAttempts.values())
        .filter((attempt) => attempt.userId === userId && attempt.passed)
        .map((attempt) => attempt.quizId),
    );

    return new Set(
      Array.from(this.quizzes.values())
        .filter((quiz) => passedQuizIds.has(quiz.id) && courseModuleIds.has(quiz.moduleId))
        .map((quiz) => quiz.moduleId),
    );
  }

  async markModuleComplete(data: InsertModuleCompletion): Promise<ModuleCompletion> {
    const id = randomUUID();
    const completion: ModuleCompletion = { ...data, id, completedAt: new Date() };
    this.moduleCompletions.set(id, completion);
    return completion;
  }

  async isModuleCompleted(userId: string, moduleId: string): Promise<boolean> {
    return Array.from(this.moduleCompletions.values()).some(
      (mc) => mc.userId === userId && mc.moduleId === moduleId,
    );
  }

  // Quizzes
  async getQuiz(id: string): Promise<Quiz | undefined> {
    return this.quizzes.get(id);
  }

  async getQuizByModule(moduleId: string): Promise<Quiz | undefined> {
    return Array.from(this.quizzes.values()).find(
      (q) => q.moduleId === moduleId,
    );
  }

  async createQuiz(insertQuiz: InsertQuiz): Promise<Quiz> {
    const id = randomUUID();
    const quiz: Quiz = { ...insertQuiz, id, passScore: insertQuiz.passScore ?? 70 };
    this.quizzes.set(id, quiz);
    return quiz;
  }

  async getAllQuizzes(): Promise<Quiz[]> {
    return Array.from(this.quizzes.values());
  }

  async updateQuiz(id: string, data: Partial<InsertQuiz>): Promise<Quiz | undefined> {
    const quiz = this.quizzes.get(id);
    if (!quiz) return undefined;
    const updated: Quiz = { ...quiz, ...data, passScore: data.passScore ?? quiz.passScore };
    this.quizzes.set(id, updated);
    return updated;
  }

  async deleteQuiz(id: string): Promise<boolean> {
    return this.quizzes.delete(id);
  }

  // Quiz Attempts
  async getQuizAttempts(userId: string, quizId: string): Promise<QuizAttempt[]> {
    return Array.from(this.quizAttempts.values())
      .filter((qa) => qa.userId === userId && qa.quizId === quizId)
      .sort((a, b) => b.attemptedAt.getTime() - a.attemptedAt.getTime());
  }

  async createQuizAttempt(insertAttempt: InsertQuizAttempt): Promise<QuizAttempt> {
    const id = randomUUID();
    const attempt: QuizAttempt = { ...insertAttempt, id, passed: insertAttempt.passed ?? false, attemptedAt: new Date() };
    this.quizAttempts.set(id, attempt);
    return attempt;
  }

  async getAllQuizAttempts(): Promise<QuizAttempt[]> {
    return Array.from(this.quizAttempts.values());
  }

  // Projects
  async getProject(id: string): Promise<Project | undefined> {
    return this.projects.get(id);
  }

  async getUserProjects(userId: string): Promise<Project[]> {
    return Array.from(this.projects.values())
      .filter((p) => p.userId === userId)
      .sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    const id = randomUUID();
    const project: Project = {
      ...insertProject,
      id,
      status: insertProject.status ?? "pending",
      submittedAt: new Date(),
    };
    this.projects.set(id, project);
    return project;
  }
}

// Production data must live in Supabase. Keep MemStorage available for reference/tests,
// but never silently fall back to it when the app is running.
export const storage = new SupabaseStorage();
