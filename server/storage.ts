import {
  type User,
  type InsertUser,
  type Course,
  type InsertCourse,
  type UserCourse,
  type InsertUserCourse,
  type CourseEnrollment,
  type Module,
  type InsertModule,
  type ModuleCompletion,
  type InsertModuleCompletion,
  type Quiz,
  type InsertQuiz,
  type QuizAttempt,
  type InsertQuizAttempt,
  type CbtQuestion,
  type CbtExamType,
  type CbtQuestionFilters,
  type InsertCbtQuestion,
  type CbtQuestionCatalogEntry,
  type CbtAttempt,
  type InsertCbtAttempt,
  type EventRecord,
  type EventNotification,
  type EventInput,
  type EventFilters,
  type EventRsvp,
  type EventRsvpStatus,
  type CourseConversationSummary,
  type CourseMessage,
  type Project,
  type InsertProject,
  type PartnershipInterest,
  type OrganizationPartnershipInterest,
} from "../shared/schema.js";
import type { PartnershipInterestInput } from "../shared/partnership-interest.js";
import type { OrganizationPartnershipInterestInput } from "../shared/organization-partnership-interest.js";
import type { CourseImportPayload } from "../shared/course-import.js";
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
  createCourseDraftFromImport(payload: CourseImportPayload, instructorId: string): Promise<Course>;
  appendCourseDraftFromImport(courseId: string, payload: CourseImportPayload): Promise<Course>;
  updateCourse(id: string, data: Partial<InsertCourse>): Promise<Course | undefined>;
  deleteCourse(id: string): Promise<boolean>;
  deleteModule(id: string): Promise<boolean>;

  // User Courses (unlocked courses)
  getUserCourses(userId: string): Promise<UserCourse[]>;
  unlockCourse(data: InsertUserCourse): Promise<UserCourse>;
  isUserCourseUnlocked(userId: string, courseId: string): Promise<boolean>;
  removeEnrollment(userId: string, courseId: string): Promise<boolean>;
  getCourseEnrollments(courseId: string): Promise<CourseEnrollment[]>;
  getAllCourseEnrollments(): Promise<CourseEnrollment[]>;
  enrollStudent(userId: string, courseId: string): Promise<CourseEnrollment>;
  isStudentEnrolled(userId: string, courseId: string): Promise<boolean>;
  removeCourseEnrollment(userId: string, courseId: string): Promise<boolean>;
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

  // CBT question bank
  getCbtQuestions(filters?: CbtQuestionFilters): Promise<CbtQuestion[]>;
  getCbtQuestion(id: string): Promise<CbtQuestion | undefined>;
  createCbtQuestions(questions: InsertCbtQuestion[]): Promise<CbtQuestion[]>;
  updateCbtQuestion(id: string, data: Partial<CbtQuestion>): Promise<CbtQuestion | undefined>;
  bulkClassifyCbtQuestions(ids: string[], examType: CbtExamType, topic: string, updatedBy: string, createdBy?: string): Promise<number>;
  getCbtQuestionCatalog(): Promise<CbtQuestionCatalogEntry[]>;

  // CBT student attempts
  createCbtAttempt(attempt: InsertCbtAttempt): Promise<CbtAttempt>;
  countCbtAttemptsSince(userId: string, since: Date): Promise<number>;
  getCbtAttempt(id: string): Promise<CbtAttempt | undefined>;
  getActiveCbtAttempt(userId: string): Promise<CbtAttempt | undefined>;
  getCbtAttemptsForUser(userId: string): Promise<CbtAttempt[]>;
  saveCbtAttemptAnswer(attemptId: string, userId: string, questionId: string, selectedOption: number | null): Promise<boolean>;
  finishCbtAttempt(id: string, data: Pick<CbtAttempt, "status" | "score" | "submittedAt">): Promise<CbtAttempt | undefined>;

  // Events, RSVPs, and in-app notifications
  getEventsForStaff(filters?: EventFilters): Promise<EventRecord[]>;
  getEventsForStudent(studentId: string): Promise<EventRecord[]>;
  getEvent(id: string, studentId?: string): Promise<EventRecord | undefined>;
  createEvent(input: EventInput, authorId: string): Promise<EventRecord>;
  updateEvent(id: string, data: Partial<EventInput> & { status?: "draft" | "published" | "cancelled"; revision?: number; publishedAt?: Date | null }): Promise<EventRecord | undefined>;
  deleteEvent(id: string): Promise<boolean>;
  setEventRsvp(eventId: string, studentId: string, status: EventRsvpStatus): Promise<EventRsvp>;
  getEventNotifications(studentId: string): Promise<EventNotification[]>;
  markEventNotificationRead(notificationId: string, studentId: string): Promise<boolean>;

  // Course messaging
  getOrCreateCourseConversation(course: Course, studentId: string): Promise<CourseConversationSummary>;
  getCourseConversation(id: string, userId: string): Promise<CourseConversationSummary | undefined>;
  getCourseConversationsForUser(userId: string): Promise<CourseConversationSummary[]>;
  getCourseMessages(conversationId: string, limit?: number): Promise<CourseMessage[]>;
  createCourseMessage(conversationId: string, senderId: string, body: string): Promise<CourseMessage>;
  markCourseMessagesRead(conversationId: string, readerId: string): Promise<void>;

  // Quiz Attempts
  getQuizAttempts(userId: string, quizId: string): Promise<QuizAttempt[]>;
  getQuizAttemptsForQuizzes(quizIds: string[]): Promise<QuizAttempt[]>;
  createQuizAttempt(attempt: InsertQuizAttempt): Promise<QuizAttempt>;
  getAllQuizAttempts(): Promise<QuizAttempt[]>;

  // Projects
  getProject(id: string): Promise<Project | undefined>;
  getUserProjects(userId: string): Promise<Project[]>;
  createProject(project: InsertProject): Promise<Project>;

  // School partnership interest
  createPartnershipInterest(input: PartnershipInterestInput): Promise<void>;
  getPartnershipInterests(): Promise<PartnershipInterest[]>;
  createOrganizationPartnershipInterest(input: OrganizationPartnershipInterestInput): Promise<void>;
  getOrganizationPartnershipInterests(): Promise<OrganizationPartnershipInterest[]>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private courses: Map<string, Course>;
  private userCourses: Map<string, UserCourse>;
  private courseEnrollments: Map<string, CourseEnrollment>;
  private modules: Map<string, Module>;
  private moduleCompletions: Map<string, ModuleCompletion>;
  private quizzes: Map<string, Quiz>;
  private cbtQuestions: Map<string, CbtQuestion>;
  private cbtAttempts: Map<string, CbtAttempt>;
  private events: Map<string, EventRecord>;
  private eventRsvps: Map<string, EventRsvp>;
  private eventNotifications: Map<string, EventNotification>;
  private eventNotificationOwners: Map<string, string>;
  private courseConversations: Map<string, { id: string; courseId: string; studentId: string; createdAt: Date; updatedAt: Date }>;
  private courseMessages: Map<string, CourseMessage>;
  private quizAttempts: Map<string, QuizAttempt>;
  private projects: Map<string, Project>;
  private partnershipInterests: Map<string, PartnershipInterest>;
  private organizationPartnershipInterests: Map<string, OrganizationPartnershipInterest>;

  constructor() {
    this.users = new Map();
    this.courses = new Map();
    this.userCourses = new Map();
    this.courseEnrollments = new Map();
    this.modules = new Map();
    this.moduleCompletions = new Map();
    this.quizzes = new Map();
    this.cbtQuestions = new Map();
    this.cbtAttempts = new Map();
    this.events = new Map();
    this.eventRsvps = new Map();
    this.eventNotifications = new Map();
    this.eventNotificationOwners = new Map();
    this.courseConversations = new Map();
    this.courseMessages = new Map();
    this.quizAttempts = new Map();
    this.projects = new Map();
    this.partnershipInterests = new Map();
    this.organizationPartnershipInterests = new Map();

    this.users.set("admin-local", {
      id: "admin-local",
      email: "admin@learnpedia.academy",
      password: "admin123",
      fullName: "Learnpedia Administrator",
      role: "admin",
      hasActiveSubscription: false,
      subscriptionTier: "none",
      subscriptionPaidAt: null,
      subscriptionExpiresAt: null,
      state: null,
      localGovernmentArea: null,
      phoneNumber: null,
      whatsappNumber: null,
      referralCode: null,
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
      subscriptionExpiresAt: null,
      state: null,
      localGovernmentArea: null,
      phoneNumber: null,
      whatsappNumber: null,
      referralCode: null,
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
      subscriptionExpiresAt: null,
      state: null,
      localGovernmentArea: null,
      phoneNumber: null,
      whatsappNumber: null,
      referralCode: null,
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

    modules.forEach((module) => this.modules.set(module.id, {
      ...module,
      videoUrls: module.videoUrl ? [module.videoUrl] : [],
    }));

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
      subscriptionExpiresAt: insertUser.subscriptionExpiresAt ?? null,
      state: insertUser.state ?? null,
      localGovernmentArea: insertUser.localGovernmentArea ?? null,
      phoneNumber: insertUser.phoneNumber ?? null,
      whatsappNumber: insertUser.whatsappNumber ?? null,
      referralCode: insertUser.referralCode ?? null,
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

  async createCourseDraftFromImport(payload: CourseImportPayload, instructorId: string): Promise<Course> {
    const course = await this.createCourse({
      title: payload.title,
      description: payload.description,
      accessCode: "",
      thumbnail: null,
      enrollmentMode: "self",
      instructorId,
      isPublished: false,
      publishedAt: null,
    });
    const moduleIds: string[] = [];
    for (const importedModule of payload.modules) {
      const parentModuleId = importedModule.parentIndex === null
        ? null
        : moduleIds[importedModule.parentIndex];
      if (importedModule.parentIndex !== null && !parentModuleId) {
        this.courses.delete(course.id);
        for (const moduleId of moduleIds) this.modules.delete(moduleId);
        throw new Error("Course import contains a lesson without a preceding module");
      }

      const module = await this.createModule({
        courseId: course.id,
        title: importedModule.title,
        order: importedModule.order,
        content: importedModule.content,
        videoUrls: importedModule.videoUrls,
        imageUrl: null,
        parentModuleId,
        prerequisiteModuleId: null,
        duration: 30,
      });
      moduleIds.push(module.id);
    }
    return course;
  }

  async appendCourseDraftFromImport(courseId: string, payload: CourseImportPayload): Promise<Course> {
    const course = await this.getCourse(courseId);
    if (!course) throw new Error("Course not found");

    const existingRootModules = (await this.getModulesByCourse(courseId))
      .filter((module) => module.parentModuleId === null);
    const rootOrderOffset = Math.max(0, ...existingRootModules.map((module) => module.order));
    const moduleIds: string[] = [];

    try {
      for (const importedModule of payload.modules) {
        const parentModuleId = importedModule.parentIndex === null
          ? null
          : moduleIds[importedModule.parentIndex];
        if (importedModule.parentIndex !== null && !parentModuleId) {
          throw new Error("Course import contains a lesson without a preceding module");
        }

        const module = await this.createModule({
          courseId,
          title: importedModule.title,
          order: importedModule.parentIndex === null
            ? rootOrderOffset + importedModule.order
            : importedModule.order,
          content: importedModule.content,
          videoUrls: importedModule.videoUrls,
          imageUrl: null,
          parentModuleId,
          prerequisiteModuleId: null,
          duration: 30,
        });
        moduleIds.push(module.id);
      }
    } catch (error) {
      for (const moduleId of moduleIds) this.modules.delete(moduleId);
      throw error;
    }

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
    const userCourse: UserCourse = { ...data, accessSource: data.accessSource ?? "manual", id, unlockedAt: new Date() };
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

  async getCourseEnrollments(courseId: string): Promise<CourseEnrollment[]> {
    return Array.from(this.courseEnrollments.values()).filter((item) => item.courseId === courseId);
  }

  async getAllCourseEnrollments(): Promise<CourseEnrollment[]> {
    return Array.from(this.courseEnrollments.values());
  }

  async enrollStudent(userId: string, courseId: string): Promise<CourseEnrollment> {
    const existing = Array.from(this.courseEnrollments.values()).find(
      (item) => item.userId === userId && item.courseId === courseId,
    );
    if (existing) return existing;
    const enrollment: CourseEnrollment = {
      id: randomUUID(),
      userId,
      courseId,
      enrolledAt: new Date(),
    };
    this.courseEnrollments.set(enrollment.id, enrollment);
    return enrollment;
  }

  async isStudentEnrolled(userId: string, courseId: string): Promise<boolean> {
    return Array.from(this.courseEnrollments.values()).some(
      (item) => item.userId === userId && item.courseId === courseId,
    );
  }

  async removeCourseEnrollment(userId: string, courseId: string): Promise<boolean> {
    const enrollment = Array.from(this.courseEnrollments.entries()).find(
      ([, item]) => item.userId === userId && item.courseId === courseId,
    );
    return enrollment ? this.courseEnrollments.delete(enrollment[0]) : false;
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
      videoUrls: insertModule.videoUrls ?? (insertModule.videoUrl ? [insertModule.videoUrl] : []),
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
    const updated: Module = {
      ...module,
      ...data,
      videoUrl: data.videoUrls !== undefined && data.videoUrl === undefined
        ? data.videoUrls[0] ?? null
        : data.videoUrl ?? module.videoUrl,
      videoUrls: data.videoUrls ?? (data.videoUrl !== undefined
        ? data.videoUrl ? [data.videoUrl] : []
        : module.videoUrls),
      imageUrl: data.imageUrl ?? module.imageUrl,
      parentModuleId: data.parentModuleId ?? module.parentModuleId,
      prerequisiteModuleId: data.prerequisiteModuleId ?? module.prerequisiteModuleId,
      duration: data.duration ?? module.duration,
    };
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

  // CBT question bank
  async getCbtQuestions(filters: CbtQuestionFilters = {}): Promise<CbtQuestion[]> {
    return Array.from(this.cbtQuestions.values())
      .filter((question) => !filters.ids || filters.ids.includes(question.id))
      .filter((question) => !filters.examType || question.examType === filters.examType)
      .filter((question) => !filters.subject || question.subject.toLowerCase() === filters.subject.toLowerCase())
      .filter((question) => filters.examYear === undefined || question.examYear === filters.examYear)
      .filter((question) => !filters.topic || question.topic === filters.topic)
      .filter((question) => !filters.topics || filters.topics.includes(question.topic ?? ""))
      .filter((question) => !filters.requireTopic || !!question.topic?.trim())
      .filter((question) => !filters.status || question.status === filters.status)
      .filter((question) => !filters.createdBy || question.createdBy === filters.createdBy)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  async getCbtQuestion(id: string): Promise<CbtQuestion | undefined> {
    return this.cbtQuestions.get(id);
  }

  async createCbtQuestions(inputs: InsertCbtQuestion[]): Promise<CbtQuestion[]> {
    const now = new Date();
    const questions = inputs.map((input) => {
      const question: CbtQuestion = {
        ...input,
        id: randomUUID(),
        questionImageUrl: input.questionImageUrl ?? null,
        explanation: input.explanation || null,
        explanationImageUrl: input.explanationImageUrl ?? null,
        status: "draft",
        updatedBy: input.createdBy,
        publishedBy: null,
        publishedAt: null,
        archivedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      return question;
    });
    for (const question of questions) this.cbtQuestions.set(question.id, question);
    return questions;
  }

  async updateCbtQuestion(id: string, data: Partial<CbtQuestion>): Promise<CbtQuestion | undefined> {
    const question = this.cbtQuestions.get(id);
    if (!question) return undefined;
    const updated = { ...question, ...data, updatedAt: data.updatedAt ?? new Date() };
    this.cbtQuestions.set(id, updated);
    return updated;
  }

  async bulkClassifyCbtQuestions(
    ids: string[],
    examType: CbtExamType,
    topic: string,
    updatedBy: string,
    createdBy?: string,
  ): Promise<number> {
    const questions = ids.map((id) => this.cbtQuestions.get(id));
    if (questions.some((question) => !question || (createdBy && question.createdBy !== createdBy))) return 0;
    const now = new Date();
    for (const question of questions) {
      if (!question) continue;
      this.cbtQuestions.set(question.id, {
        ...question,
        examType,
        topic,
        status: question.status === "published" ? "draft" : question.status,
        publishedBy: question.status === "published" ? null : question.publishedBy,
        publishedAt: question.status === "published" ? null : question.publishedAt,
        updatedBy,
        updatedAt: now,
      });
    }
    return questions.length;
  }

  async getCbtQuestionCatalog(): Promise<CbtQuestionCatalogEntry[]> {
    const grouped = new Map<string, CbtQuestionCatalogEntry>();
    for (const question of Array.from(this.cbtQuestions.values())) {
      if (question.status !== "published" || !question.examType || !question.topic) continue;
      const key = `${question.examType}\u0000${question.subject.toLowerCase()}\u0000${question.examYear}\u0000${question.topic}`;
      const existing = grouped.get(key);
      if (existing) existing.count += 1;
      else grouped.set(key, {
        examType: question.examType,
        subject: question.subject,
        examYear: question.examYear,
        topic: question.topic,
        count: 1,
      });
    }
    return Array.from(grouped.values()).sort((a, b) =>
      a.examType.localeCompare(b.examType)
      || a.subject.localeCompare(b.subject)
      || b.examYear - a.examYear
      || a.topic.localeCompare(b.topic),
    );
  }

  async createCbtAttempt(input: InsertCbtAttempt): Promise<CbtAttempt> {
    if (Array.from(this.cbtAttempts.values()).some(
      (attempt) => attempt.userId === input.userId && attempt.status === "in_progress",
    )) {
      throw new Error("An active CBT attempt already exists for this student");
    }
    const attempt: CbtAttempt = {
      ...input,
      id: randomUUID(),
      answers: {},
      score: null,
      submittedAt: null,
      createdAt: new Date(),
    };
    this.cbtAttempts.set(attempt.id, attempt);
    return attempt;
  }

  async countCbtAttemptsSince(userId: string, since: Date): Promise<number> {
    return Array.from(this.cbtAttempts.values())
      .filter((attempt) => attempt.userId === userId && attempt.createdAt >= since)
      .length;
  }

  async getCbtAttempt(id: string): Promise<CbtAttempt | undefined> {
    return this.cbtAttempts.get(id);
  }

  async getActiveCbtAttempt(userId: string): Promise<CbtAttempt | undefined> {
    return Array.from(this.cbtAttempts.values())
      .find((attempt) => attempt.userId === userId && attempt.status === "in_progress");
  }

  async getCbtAttemptsForUser(userId: string): Promise<CbtAttempt[]> {
    return Array.from(this.cbtAttempts.values())
      .filter((attempt) => attempt.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 20);
  }

  async saveCbtAttemptAnswer(
    attemptId: string,
    userId: string,
    questionId: string,
    selectedOption: number | null,
  ): Promise<boolean> {
    const attempt = this.cbtAttempts.get(attemptId);
    if (
      !attempt
      || attempt.userId !== userId
      || attempt.status !== "in_progress"
      || attempt.expiresAt.getTime() <= Date.now()
      || !attempt.questions.some((question) => question.id === questionId)
    ) return false;

    const answers = { ...attempt.answers };
    if (selectedOption === null) delete answers[questionId];
    else answers[questionId] = selectedOption;
    this.cbtAttempts.set(attemptId, { ...attempt, answers });
    return true;
  }

  async finishCbtAttempt(
    id: string,
    data: Pick<CbtAttempt, "status" | "score" | "submittedAt">,
  ): Promise<CbtAttempt | undefined> {
    const attempt = this.cbtAttempts.get(id);
    if (!attempt || attempt.status !== "in_progress") return undefined;
    const updated = { ...attempt, ...data };
    this.cbtAttempts.set(id, updated);
    return updated;
  }

  private withEventRsvps(event: EventRecord, studentId?: string): EventRecord {
    const rsvps = Array.from(this.eventRsvps.values()).filter((rsvp) => rsvp.eventId === event.id);
    return {
      ...event,
      rsvpCount: rsvps.filter((rsvp) => rsvp.status === "attending").length,
      rsvpStatus: rsvps.find((rsvp) => rsvp.studentId === studentId)?.status ?? null,
    };
  }

  private notifyStudentsForEvent(event: EventRecord): void {
    for (const student of Array.from(this.users.values()).filter((user) => user.role === "student")) {
      const exists = Array.from(this.eventNotifications.values()).some(
        (notification) =>
          notification.eventId === event.id
          && notification.revision === event.revision
          && this.eventNotificationOwners.get(notification.id) === student.id,
      );
      if (exists) continue;
      const notification: EventNotification = {
        id: randomUUID(),
        eventId: event.id,
        revision: event.revision,
        title: event.title,
        startsAt: event.startsAt,
        status: event.status,
        createdAt: new Date(),
        readAt: null,
      };
      this.eventNotifications.set(notification.id, notification);
      this.eventNotificationOwners.set(notification.id, student.id);
    }
  }

  async getEventsForStaff(filters: EventFilters = {}): Promise<EventRecord[]> {
    return Array.from(this.events.values())
      .filter((event) => !filters.authorId || event.authorId === filters.authorId)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .map((event) => this.withEventRsvps(event));
  }

  async getEventsForStudent(studentId: string): Promise<EventRecord[]> {
    return Array.from(this.events.values())
      .filter((event) => event.status === "published" || event.status === "cancelled")
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
      .map((event) => this.withEventRsvps(event, studentId));
  }

  async getEvent(id: string, studentId?: string): Promise<EventRecord | undefined> {
    const event = this.events.get(id);
    return event ? this.withEventRsvps(event, studentId) : undefined;
  }

  async createEvent(input: EventInput, authorId: string): Promise<EventRecord> {
    const now = new Date();
    const event: EventRecord = {
      id: randomUUID(),
      title: input.title,
      description: input.description,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      timezone: input.timezone,
      location: input.location || null,
      meetingUrl: input.meetingUrl || null,
      status: "draft",
      revision: 0,
      authorId,
      authorName: this.users.get(authorId)?.fullName || "Staff",
      publishedAt: null,
      createdAt: now,
      updatedAt: now,
      rsvpCount: 0,
      rsvpStatus: null,
    };
    this.events.set(event.id, event);
    return event;
  }

  async updateEvent(
    id: string,
    data: Partial<EventInput> & { status?: "draft" | "published" | "cancelled"; revision?: number; publishedAt?: Date | null },
  ): Promise<EventRecord | undefined> {
    const current = this.events.get(id);
    if (!current) return undefined;
    const updated: EventRecord = {
      ...current,
      ...data,
      location: data.location === undefined ? current.location : data.location || null,
      meetingUrl: data.meetingUrl === undefined ? current.meetingUrl : data.meetingUrl || null,
      authorName: current.authorName,
      rsvpCount: current.rsvpCount,
      rsvpStatus: current.rsvpStatus,
      updatedAt: new Date(),
    };
    this.events.set(id, updated);
    if (
      (updated.status === "published" && (current.status !== "published" || updated.revision > current.revision))
      || (updated.status === "cancelled" && current.status === "published")
    ) this.notifyStudentsForEvent(updated);
    return updated;
  }

  async deleteEvent(id: string): Promise<boolean> {
    if (this.events.get(id)?.status !== "draft") return false;
    this.events.delete(id);
    for (const [key, rsvp] of Array.from(this.eventRsvps.entries())) {
      if (rsvp.eventId === id) this.eventRsvps.delete(key);
    }
    for (const [key, notification] of Array.from(this.eventNotifications.entries())) {
      if (notification.eventId === id) this.eventNotifications.delete(key);
    }
    return true;
  }

  async setEventRsvp(eventId: string, studentId: string, status: EventRsvpStatus): Promise<EventRsvp> {
    const key = `${eventId}:${studentId}`;
    const rsvp: EventRsvp = { eventId, studentId, status, updatedAt: new Date() };
    this.eventRsvps.set(key, rsvp);
    return rsvp;
  }

  async getEventNotifications(studentId: string): Promise<EventNotification[]> {
    return Array.from(this.eventNotifications.entries())
      .filter(([id]) => this.eventNotificationOwners.get(id) === studentId)
      .map(([, notification]) => notification)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 30);
  }

  async markEventNotificationRead(notificationId: string, studentId: string): Promise<boolean> {
    const notification = this.eventNotifications.get(notificationId);
    if (!notification || this.eventNotificationOwners.get(notificationId) !== studentId || notification.readAt) return false;
    this.eventNotifications.set(notificationId, { ...notification, readAt: new Date() });
    return true;
  }

  private mapCourseConversation(
    conversation: { id: string; courseId: string; studentId: string; createdAt: Date; updatedAt: Date },
    userId?: string,
  ): CourseConversationSummary | undefined {
    const course = this.courses.get(conversation.courseId);
    const student = this.users.get(conversation.studentId);
    const instructor = course?.instructorId ? this.users.get(course.instructorId) : undefined;
    if (!course || !student || !instructor) return undefined;
    return {
      id: conversation.id,
      courseId: course.id,
      courseTitle: course.title,
      studentId: student.id,
      studentName: student.fullName,
      instructorId: instructor.id,
      instructorName: instructor.fullName,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      unreadCount: Array.from(this.courseMessages.values()).filter((message) =>
        message.conversationId === conversation.id
        && message.senderId !== userId
        && !message.readAt,
      ).length,
    };
  }

  async getOrCreateCourseConversation(course: Course, studentId: string): Promise<CourseConversationSummary> {
    let conversation = Array.from(this.courseConversations.values()).find(
      (item) => item.courseId === course.id && item.studentId === studentId,
    );
    if (!conversation) {
      const now = new Date();
      conversation = { id: randomUUID(), courseId: course.id, studentId, createdAt: now, updatedAt: now };
      this.courseConversations.set(conversation.id, conversation);
    }
    const summary = this.mapCourseConversation(conversation, studentId);
    if (!summary) throw new Error("Course conversation participants are unavailable");
    return summary;
  }

  async getCourseConversation(id: string, userId: string): Promise<CourseConversationSummary | undefined> {
    const conversation = this.courseConversations.get(id);
    return conversation ? this.mapCourseConversation(conversation, userId) : undefined;
  }

  async getCourseConversationsForUser(userId: string): Promise<CourseConversationSummary[]> {
    return Array.from(this.courseConversations.values())
      .filter((conversation) => {
        const course = this.courses.get(conversation.courseId);
        return conversation.studentId === userId || course?.instructorId === userId;
      })
      .map((conversation) => this.mapCourseConversation(conversation, userId))
      .filter((summary): summary is CourseConversationSummary => !!summary)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  async getCourseMessages(conversationId: string, limit = 100): Promise<CourseMessage[]> {
    return Array.from(this.courseMessages.values())
      .filter((message) => message.conversationId === conversationId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .slice(-limit);
  }

  async createCourseMessage(conversationId: string, senderId: string, body: string): Promise<CourseMessage> {
    const user = this.users.get(senderId);
    const conversation = this.courseConversations.get(conversationId);
    if (!user || !conversation) throw new Error("Course conversation not found");
    const message: CourseMessage = {
      id: randomUUID(),
      conversationId,
      senderId,
      senderName: user.fullName,
      body,
      createdAt: new Date(),
      readAt: null,
    };
    this.courseMessages.set(message.id, message);
    this.courseConversations.set(conversationId, { ...conversation, updatedAt: message.createdAt });
    return message;
  }

  async markCourseMessagesRead(conversationId: string, readerId: string): Promise<void> {
    const readAt = new Date();
    for (const [id, message] of Array.from(this.courseMessages.entries())) {
      if (message.conversationId === conversationId && message.senderId !== readerId && !message.readAt) {
        this.courseMessages.set(id, { ...message, readAt });
      }
    }
  }

  // Quiz Attempts
  async getQuizAttempts(userId: string, quizId: string): Promise<QuizAttempt[]> {
    return Array.from(this.quizAttempts.values())
      .filter((qa) => qa.userId === userId && qa.quizId === quizId)
      .sort((a, b) => b.attemptedAt.getTime() - a.attemptedAt.getTime());
  }

  async getQuizAttemptsForQuizzes(quizIds: string[]): Promise<QuizAttempt[]> {
    const quizIdSet = new Set(quizIds);
    return Array.from(this.quizAttempts.values()).filter((attempt) => quizIdSet.has(attempt.quizId));
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

  async createPartnershipInterest(input: PartnershipInterestInput): Promise<void> {
    const id = randomUUID();
    this.partnershipInterests.set(id, {
      ...input,
      id,
      submittedAt: new Date(),
    });
  }

  async getPartnershipInterests(): Promise<PartnershipInterest[]> {
    return Array.from(this.partnershipInterests.values())
      .sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());
  }

  async createOrganizationPartnershipInterest(input: OrganizationPartnershipInterestInput): Promise<void> {
    const id = randomUUID();
    this.organizationPartnershipInterests.set(id, {
      ...input,
      id,
      submittedAt: new Date(),
    });
  }

  async getOrganizationPartnershipInterests(): Promise<OrganizationPartnershipInterest[]> {
    return Array.from(this.organizationPartnershipInterests.values())
      .sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());
  }
}

// Production data must live in Supabase. Keep MemStorage available for reference/tests,
// but never silently fall back to it when the app is running.
export const storage = new SupabaseStorage();
