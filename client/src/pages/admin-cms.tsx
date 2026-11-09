import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth-context";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { QuizMarkdownEditor } from "@/components/quiz/quiz-markdown";
import { LessonSpeechControls } from "@/components/course/lesson-speech-controls";
import type { AnnouncementRecord } from "@/lib/announcements";
import type { CbtExamType, Course, EventRecord, Module, OrganizationPartnershipInterest, PartnershipInterest, QuizQuestion, User } from "@shared/schema";
import { Archive, BarChart3, BookOpen, CalendarDays, ClipboardList, CreditCard, Download, FileQuestion, FileUp, Handshake, LayoutDashboard, Pencil, Plus, RotateCcw, Send, Settings2, Trash2, UserRound, Users, X } from "lucide-react";
import { isInitialEmptyQuizQuestion, parseQuizCsv, type QuizCsvPreview } from "@/lib/quiz-csv";
import { formatDateTimeForZone, localDateTimeToUtc } from "@shared/event-utils";
import { getModuleDisplayLabel } from "@shared/module-utils";

type Section = "overview" | "courses" | "modules" | "quizzes" | "events" | "cbt" | "users" | "enrollments" | "progress" | "analytics" | "announcements" | "payments" | "partnerships";

interface QuizRecord {
  id: string;
  moduleId: string;
  title: string;
  passScore: number;
  questions: QuizQuestion[];
}

interface QuizQuestionDraft {
  id: string;
  question: string;
  questionImageUrl: string;
  explanation: string;
  explanationImageUrl: string;
  options: string[];
  correctAnswer: string;
}

interface QuizDraft {
  moduleId: string;
  title: string;
  passScore: string;
  questions: QuizQuestionDraft[];
}

interface PersistedCmsDraft {
  section: Section;
  selectedCourseId: string;
  courseDraft: { title: string; description: string; enrollmentMode: string; instructorId: string; thumbnail: string; isPublished: boolean };
  newCourseDraft: { title: string; description: string; enrollmentMode: string; instructorId: string; thumbnail: string; isPublished: boolean };
  moduleDraft: { title: string; order: string; content: string; duration: string; parentModuleId: string; prerequisiteModuleId: string; videoUrls?: string[]; videoUrl?: string; imageUrl: string };
  editingModuleId: string | null;
  quizDraft: QuizDraft;
  editingQuizId: string | null;
}

function getReadPartnershipIds(userId: string): string[] {
  try {
    const stored = localStorage.getItem(`admin-read-partnerships:${userId}`);
    const parsed: unknown = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) && parsed.every((id) => typeof id === "string") ? parsed : [];
  } catch (error) {
    console.warn("Could not read viewed partnership submissions:", error);
    return [];
  }
}

interface Analytics {
  totalUsers: number;
  totalCourses: number;
  totalEnrollments: number;
  quizAttempts: number;
  passedQuizzes: number;
  courseStats: Array<{ id: string; title: string; enrollments: number; completionRate: number }>;
}

interface CourseLearnerProgress {
  id: string;
  fullName: string;
  email: string;
  enrolledAt: string;
  progress: number;
  completedModules: number;
  totalModules: number;
  lastActivityAt: string | null;
  modules: Array<{
    id: string;
    title: string;
    order: number;
    parentModuleId: string | null;
    isCompleted: boolean;
    completedAt: string | null;
    hasQuiz: boolean;
    isQuizPassed: boolean;
    latestQuizScore: number | null;
    latestQuizTotal: number | null;
    latestQuizPassed: boolean | null;
    latestQuizAt: string | null;
  }>;
}

interface CourseProgressResponse {
  course: { id: string; title: string };
  learners: CourseLearnerProgress[];
}

interface ManualPaymentSubmission {
  id: string;
  user_id: string;
  plan: "monthly" | "yearly";
  amount: number;
  currency: string;
  bank_name: string;
  bank_reference: string;
  status: "pending" | "approved" | "rejected";
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  user: { full_name: string; email: string } | null;
}

interface CbtQuestionRecord {
  id: string;
  examType: CbtExamType | null;
  subject: string;
  examYear: number;
  topic: string | null;
  question: string;
  questionImageUrl: string | null;
  options: string[];
  correctAnswer: number;
  explanation: string | null;
  explanationImageUrl: string | null;
  status: "draft" | "published" | "archived";
  createdBy: string;
  publishedBy: string | null;
  publishedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CbtQuestionDraft {
  examType: CbtExamType | "";
  subject: string;
  examYear: string;
  topic: string;
  question: string;
  questionImageUrl: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  explanationImageUrl: string;
}

const navItems: Array<{ id: Section; label: string; icon: typeof LayoutDashboard }> = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "courses", label: "Courses", icon: BookOpen },
  { id: "modules", label: "Modules", icon: Settings2 },
  { id: "quizzes", label: "Quizzes", icon: FileQuestion },
  { id: "events", label: "Events", icon: CalendarDays },
  { id: "cbt", label: "CBT question bank", icon: ClipboardList },
  { id: "users", label: "Users", icon: UserRound },
  { id: "enrollments", label: "Enrollments", icon: Users },
  { id: "progress", label: "Learner progress", icon: BarChart3 },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "announcements", label: "Announcements", icon: Plus },
  { id: "payments", label: "Payments", icon: CreditCard },
  { id: "partnerships", label: "Partner applications", icon: Handshake },
];

const isStaffRole = (role?: string | null) => ["admin", "super_admin", "instructor"].includes(role || "");
const isSuperAdmin = (role?: string | null) => ["admin", "super_admin", "superadmin"].includes(role || "");
const canReviewPayments = (role?: string | null) => role === "super_admin";
const sections = new Set<Section>(["overview", "courses", "modules", "quizzes", "events", "cbt", "users", "enrollments", "progress", "analytics", "announcements", "payments", "partnerships"]);

function createEmptyQuizQuestion(): QuizQuestionDraft {
  return { id: crypto.randomUUID(), question: "", questionImageUrl: "", explanation: "", explanationImageUrl: "", options: ["", "", "", ""], correctAnswer: "1" };
}

function readCmsDraft(userId: string): Partial<PersistedCmsDraft> | null {
  if (!userId) return null;
  try {
    const stored = sessionStorage.getItem(`admin-cms-draft:${userId}`);
    if (!stored) return null;
    const value: unknown = JSON.parse(stored);
    if (!value || typeof value !== "object") return null;
    const draft = value as Partial<PersistedCmsDraft>;
    return {
      ...(draft.section && sections.has(draft.section) ? { section: draft.section } : {}),
      ...(typeof draft.selectedCourseId === "string" ? { selectedCourseId: draft.selectedCourseId } : {}),
      ...(draft.courseDraft && typeof draft.courseDraft === "object" ? { courseDraft: draft.courseDraft } : {}),
      ...(draft.newCourseDraft && typeof draft.newCourseDraft === "object" ? { newCourseDraft: draft.newCourseDraft } : {}),
      ...(draft.moduleDraft && typeof draft.moduleDraft === "object" ? { moduleDraft: draft.moduleDraft } : {}),
      ...(draft.editingModuleId === null || typeof draft.editingModuleId === "string" ? { editingModuleId: draft.editingModuleId } : {}),
      ...(draft.quizDraft && typeof draft.quizDraft === "object" ? { quizDraft: draft.quizDraft } : {}),
      ...(draft.editingQuizId === null || typeof draft.editingQuizId === "string" ? { editingQuizId: draft.editingQuizId } : {}),
    };
  } catch (error) {
    console.error("Failed to restore the admin CMS draft:", error);
    return null;
  }
}

export default function AdminCms() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const adminId = user?.id || "";
  const [section, setSection] = useState<Section>("overview");
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [courseDraft, setCourseDraft] = useState({ title: "", description: "", enrollmentMode: "self", instructorId: "", thumbnail: "", isPublished: false });
  const [newCourseDraft, setNewCourseDraft] = useState({ title: "", description: "", enrollmentMode: "self", instructorId: "", thumbnail: "", isPublished: false });
  const [moduleDraft, setModuleDraft] = useState({ title: "", order: "1", content: "", duration: "30", parentModuleId: "", prerequisiteModuleId: "", videoUrls: [""], imageUrl: "" });
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);
  const [quizDraft, setQuizDraft] = useState<QuizDraft>({ moduleId: "", title: "", passScore: "70", questions: [createEmptyQuizQuestion()] });
  const [editingQuizId, setEditingQuizId] = useState<string | null>(null);
  const [restoredDraftUserId, setRestoredDraftUserId] = useState("");
  const [enrollment, setEnrollment] = useState({ userId: "", courseId: "" });
  const [instructorDraft, setInstructorDraft] = useState({ fullName: "", email: "", password: "" });
  const [createdInstructor, setCreatedInstructor] = useState<{ fullName: string; email: string; temporaryPassword: string } | null>(null);
  const [announcementDraft, setAnnouncementDraft] = useState({ title: "", message: "" });
  const [paymentReviewNotes, setPaymentReviewNotes] = useState<Record<string, string>>({});
  const [readPartnershipIds, setReadPartnershipIds] = useState<string[]>([]);
  const courseEditorRef = useRef<HTMLDivElement>(null);

  const canManage = !!user && isStaffRole(user.role);

  useEffect(() => {
    if (!isAuthenticated) setLocation("/login");
  }, [isAuthenticated, setLocation]);

  useEffect(() => {
    const draft = readCmsDraft(adminId);
    if (adminId) setReadPartnershipIds(getReadPartnershipIds(adminId));
    if (draft) {
      if (draft.section) {
        const restrictedSection = (draft.section === "payments" && !canReviewPayments(user?.role))
          || (draft.section === "partnerships" && !isSuperAdmin(user?.role));
        setSection(restrictedSection ? "overview" : draft.section);
      }
      if (typeof draft.selectedCourseId === "string") setSelectedCourseId(draft.selectedCourseId);
      if (draft.courseDraft) setCourseDraft((current) => ({ ...current, ...draft.courseDraft }));
      if (draft.newCourseDraft) setNewCourseDraft((current) => ({ ...current, ...draft.newCourseDraft }));
      if (draft.moduleDraft) {
        const restoredModuleDraft = draft.moduleDraft;
        setModuleDraft((current) => ({
          ...current,
          ...restoredModuleDraft,
          videoUrls: Array.isArray(restoredModuleDraft.videoUrls)
            ? restoredModuleDraft.videoUrls
            : restoredModuleDraft.videoUrl
              ? [restoredModuleDraft.videoUrl]
              : [""],
        }));
      }
      if (draft.editingModuleId !== undefined) setEditingModuleId(draft.editingModuleId);
      if (draft.quizDraft) {
        setQuizDraft({
          ...draft.quizDraft,
          questions: Array.isArray(draft.quizDraft.questions) && draft.quizDraft.questions.length
            ? draft.quizDraft.questions.map((question) => ({
                ...createEmptyQuizQuestion(),
                ...question,
              }))
            : [createEmptyQuizQuestion()],
        });
      }
      if (draft.editingQuizId !== undefined) setEditingQuizId(draft.editingQuizId);
    }
    setRestoredDraftUserId(adminId);
  }, [adminId]);

  useEffect(() => {
    if (!adminId || restoredDraftUserId !== adminId) return;
    try {
      const draft: PersistedCmsDraft = {
        section,
        selectedCourseId,
        courseDraft,
        newCourseDraft,
        moduleDraft,
        editingModuleId,
        quizDraft,
        editingQuizId,
      };
      sessionStorage.setItem(`admin-cms-draft:${adminId}`, JSON.stringify(draft));
    } catch (error) {
      console.error("Failed to save the admin CMS draft:", error);
    }
  }, [adminId, restoredDraftUserId, section, selectedCourseId, courseDraft, newCourseDraft, moduleDraft, editingModuleId, quizDraft, editingQuizId]);

  useEffect(() => {
    if (section === "courses" && selectedCourseId) {
      courseEditorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [section, selectedCourseId]);

  const announcementFeed = useQuery<AnnouncementRecord[]>({ queryKey: ["/api/announcements"] });

  const createAnnouncement = useMutation({
    mutationFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Your Supabase session has expired. Please sign in again.");
      const response = await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(announcementDraft),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to post announcement");
      return result;
    },
    onSuccess: () => {
      invalidate(["/api/announcements"]);
      setAnnouncementDraft({ title: "", message: "" });
      toast({ title: "Announcement posted", description: "Students can now view it from their dashboard." });
    },
    onError: (error: Error) => toast({ title: "Could not post announcement", description: error.message, variant: "destructive" }),
  });

  const partnershipInterests = useQuery<PartnershipInterest[]>({
    queryKey: ["/api/admin/partnership-interests", adminId],
    queryFn: () => apiRequest("GET", "/api/admin/partnership-interests"),
    enabled: isSuperAdmin(user?.role),
    refetchInterval: 60_000,
  });
  const organizationPartnershipInterests = useQuery<OrganizationPartnershipInterest[]>({
    queryKey: ["/api/admin/organization-partnership-interests", adminId],
    queryFn: () => apiRequest("GET", "/api/admin/organization-partnership-interests"),
    enabled: isSuperAdmin(user?.role),
    refetchInterval: 60_000,
  });

  const unreadPartnershipCount =
    (partnershipInterests.data || []).filter((submission) => !readPartnershipIds.includes(submission.id)).length
    + (organizationPartnershipInterests.data || [])
      .filter((submission) => !readPartnershipIds.includes(`organization:${submission.id}`)).length;

  useEffect(() => {
    if (
      section !== "partnerships"
      || !adminId
      || !partnershipInterests.data
      || !organizationPartnershipInterests.data
    ) return;
    const nextReadIds = Array.from(new Set([
      ...readPartnershipIds,
      ...partnershipInterests.data.map((submission) => submission.id),
      ...organizationPartnershipInterests.data.map((submission) => `organization:${submission.id}`),
    ]));
    try {
      localStorage.setItem(`admin-read-partnerships:${adminId}`, JSON.stringify(nextReadIds));
      setReadPartnershipIds(nextReadIds);
    } catch (error) {
      console.error("Could not mark partnership submissions as viewed:", error);
    }
  }, [section, adminId, partnershipInterests.data, organizationPartnershipInterests.data]);

  const courses = useQuery<Course[]>({
    queryKey: ["/api/admin/courses", user?.id],
    queryFn: () => apiRequest("GET", `/api/admin/courses?userId=${user?.id}`),
    enabled: canManage,
  });

  const users = useQuery<Omit<User, "password">[]>({
    queryKey: ["/api/admin/users", user?.id],
    queryFn: () => apiRequest("GET", `/api/admin/users?userId=${user?.id}`),
    enabled: canManage,
  });

  const modules = useQuery<Module[]>({
    queryKey: ["/api/modules/course", selectedCourseId],
    enabled: !!selectedCourseId,
    queryFn: () => apiRequest("GET", `/api/modules/course/${selectedCourseId}`),
  });

  const quizzes = useQuery<QuizRecord[]>({
    queryKey: ["/api/admin/quizzes", user?.id],
    queryFn: () => apiRequest("GET", `/api/admin/quizzes?userId=${user?.id}`),
    enabled: canManage,
  });

  const analytics = useQuery<Analytics>({
    queryKey: ["/api/admin/analytics", user?.id],
    queryFn: () => apiRequest("GET", `/api/admin/analytics?userId=${user?.id}`),
    enabled: canManage && section === "analytics",
  });

  const learnerProgress = useQuery<CourseProgressResponse>({
    queryKey: ["/api/admin/courses", selectedCourseId, "progress"],
    queryFn: () => apiRequest("GET", `/api/admin/courses/${selectedCourseId}/progress`),
    enabled: canManage && section === "progress" && !!selectedCourseId,
  });

  const manualPayments = useQuery<ManualPaymentSubmission[]>({
    queryKey: ["/api/admin/manual-payments"],
    enabled: canReviewPayments(user?.role) && section === "payments",
  });

  const invalidate = (key: string[]) => queryClient.invalidateQueries({ queryKey: key });

  const reviewManualPayment = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: "approved" | "rejected" }) =>
      apiRequest("POST", `/api/admin/manual-payments/${id}/review`, {
        decision,
        reviewNote: paymentReviewNotes[id] || undefined,
      }),
    onSuccess: (_result, variables) => {
      invalidate(["/api/admin/manual-payments"]);
      setPaymentReviewNotes((notes) => ({ ...notes, [variables.id]: "" }));
      toast({
        title: variables.decision === "approved" ? "Transfer approved" : "Transfer rejected",
        description: variables.decision === "approved"
          ? "The subscription and course access have been activated."
          : "The learner can submit a new transfer if needed.",
      });
    },
    onError: (error: Error) => toast({ title: "Could not review transfer", description: error.message, variant: "destructive" }),
  });

  const saveCourse = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/admin/courses/${selectedCourseId}`, { userId: adminId, course: courseDraft }),
    onSuccess: () => {
      invalidate(["/api/admin/courses", adminId]);
      toast({ title: "Course saved" });
    },
    onError: (error: Error) => toast({ title: "Could not save course", description: error.message, variant: "destructive" }),
  });

  const publishCourse = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/admin/courses/${selectedCourseId}`, { userId: adminId, course: { ...courseDraft, isPublished: !courseDraft.isPublished } }),
    onSuccess: () => {
      invalidate(["/api/admin/courses", adminId]);
      const toggled = !courseDraft.isPublished;
      toast({
        title: toggled ? "Course published" : "Course unpublished",
        description: toggled ? "Students can now find the course on the platform." : "The course is hidden from the student catalog until it is published again.",
      });
      setCourseDraft((draft) => ({ ...draft, isPublished: !draft.isPublished }));
    },
    onError: (error: Error) => toast({ title: "Could not update course status", description: error.message, variant: "destructive" }),
  });

  const deleteCourse = useMutation({
    mutationFn: (courseId: string) => apiRequest("DELETE", `/api/admin/courses/${courseId}?userId=${adminId}`),
    onSuccess: () => {
      invalidate(["/api/admin/courses", adminId]);
      toast({ title: "Course deleted" });
      if (selectedCourseId) {
        setSelectedCourseId("");
      }
    },
    onError: (error: Error) => toast({ title: "Could not delete course", description: error.message, variant: "destructive" }),
  });

  const createCourse = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/courses", {
      userId: adminId,
      course: {
        ...newCourseDraft,
        thumbnail: newCourseDraft.thumbnail || null,
        instructorId: newCourseDraft.instructorId || null,
        isPublished: false,
      },
    }),
    onSuccess: (course: Course) => {
      invalidate(["/api/admin/courses", adminId]);
      setSelectedCourseId(course.id);
      setCourseDraft({
        title: course.title,
        description: course.description,
        enrollmentMode: course.enrollmentMode,
        instructorId: course.instructorId || user?.id || "",
        thumbnail: course.thumbnail || "",
        isPublished: !!course.isPublished,
      });
      setModuleDraft({ title: "", order: "1", content: "", duration: "30", parentModuleId: "", prerequisiteModuleId: "", videoUrls: [""], imageUrl: "" });
      setEditingModuleId(null);
      setQuizDraft({ moduleId: "", title: "", passScore: "70", questions: [createEmptyQuizQuestion()] });
      setEditingQuizId(null);
      setNewCourseDraft({ title: "", description: "", enrollmentMode: "self", instructorId: user?.id || "", thumbnail: "", isPublished: false });
      setSection("modules");
      toast({ title: "Course created", description: "Add modules and publish it when your content is ready." });
    },
    onError: (error: Error) => toast({ title: "Could not create course", description: error.message, variant: "destructive" }),
  });

  const saveModule = useMutation({
    mutationFn: () => apiRequest(editingModuleId ? "PATCH" : "POST", editingModuleId ? `/api/admin/modules/${editingModuleId}` : "/api/admin/modules", {
      userId: adminId,
      module: {
        ...moduleDraft,
        courseId: selectedCourseId,
        order: Number(moduleDraft.order),
        duration: Number(moduleDraft.duration),
        parentModuleId: moduleDraft.parentModuleId || null,
        prerequisiteModuleId: moduleDraft.prerequisiteModuleId || null,
        videoUrls: moduleDraft.videoUrls.map((videoUrl) => videoUrl.trim()).filter(Boolean),
        videoUrl: moduleDraft.videoUrls.map((videoUrl) => videoUrl.trim()).find(Boolean) || null,
        imageUrl: moduleDraft.imageUrl || null,
      },
    }),
    onSuccess: () => {
      invalidate(["/api/modules/course", selectedCourseId]);
      setEditingModuleId(null);
      setModuleDraft({ title: "", order: "1", content: "", duration: "30", parentModuleId: "", prerequisiteModuleId: "", videoUrls: [""], imageUrl: "" });
      toast({ title: editingModuleId ? "Module saved" : "Module created" });
    },
    onError: (error: Error) => toast({ title: "Could not save module", description: error.message, variant: "destructive" }),
  });

  const saveQuiz = useMutation({
    mutationFn: () => apiRequest(editingQuizId ? "PATCH" : "POST", editingQuizId ? `/api/admin/quizzes/${editingQuizId}` : "/api/admin/quizzes", {
      userId: adminId,
      quiz: {
        moduleId: quizDraft.moduleId,
        title: quizDraft.title,
        passScore: Number(quizDraft.passScore),
        questions: quizDraft.questions.map((question) => ({
          id: question.id,
          question: question.question,
          questionImageUrl: question.questionImageUrl.trim() || undefined,
          explanation: question.explanation,
          explanationImageUrl: question.explanationImageUrl.trim() || undefined,
          options: question.options,
          correctAnswer: Number(question.correctAnswer),
          correctAnswerBase: 1,
        })),
      },
    }),
    onSuccess: (_quiz, _variables, _context) => {
      invalidate(["/api/admin/quizzes", adminId]);
      setQuizDraft({ moduleId: "", title: "", passScore: "70", questions: [createEmptyQuizQuestion()] });
      setEditingQuizId(null);
      toast({ title: editingQuizId ? "Quiz updated" : "Quiz created" });
    },
    onError: (error: Error) => toast({ title: "Could not create quiz", description: error.message, variant: "destructive" }),
  });

  const deleteQuiz = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/quizzes/${id}?userId=${adminId}`),
    onSuccess: () => invalidate(["/api/admin/quizzes", adminId]),
  });

  const enroll = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/enrollments", { instructorId: user?.id, ...enrollment }),
    onSuccess: () => {
      invalidate(["/api/admin/courses", enrollment.courseId, "progress"]);
      invalidate(["/api/admin/analytics", adminId]);
      setEnrollment({ userId: "", courseId: "" });
      toast({ title: "Student enrolled" });
    },
    onError: (error: Error) => toast({ title: "Enrollment failed", description: error.message, variant: "destructive" }),
  });

  const resetProgress = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/progress/reset", { adminId: user?.id, userId: enrollment.userId, courseId: enrollment.courseId }),
    onSuccess: () => toast({ title: "Progress reset" }),
    onError: (error: Error) => toast({ title: "Reset failed", description: error.message, variant: "destructive" }),
  });

  const removeEnrollment = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/admin/enrollments", { userId: enrollment.userId, courseId: enrollment.courseId, adminId: user?.id }),
    onSuccess: () => {
      invalidate(["/api/admin/courses", enrollment.courseId, "progress"]);
      invalidate(["/api/admin/analytics", adminId]);
      toast({ title: "Enrollment removed" });
    },
    onError: (error: Error) => toast({ title: "Remove enrollment failed", description: error.message, variant: "destructive" }),
  });

  const createInstructor = useMutation({
    mutationFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        throw new Error("Your Supabase session has expired. Please sign in again.");
      }

      const response = await fetch("/api/admin/instructors", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          fullName: instructorDraft.fullName,
          email: instructorDraft.email,
          password: instructorDraft.password || undefined,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to create instructor account");
      }
      return result;
    },
    onSuccess: (result: { user: User; temporaryPassword: string }) => {
      invalidate(["/api/admin/users", adminId]);
      setCreatedInstructor({ fullName: result.user.fullName, email: result.user.email, temporaryPassword: result.temporaryPassword });
      setInstructorDraft({ fullName: "", email: "", password: "" });
      toast({ title: "Instructor account created", description: "Share the temporary login details securely with the instructor." });
    },
    onError: (error: Error) => toast({ title: "Could not create instructor", description: error.message, variant: "destructive" }),
  });

  if (!user) return null;
  if (!canManage) {
    return (
      <>
        <Navbar />
        <main className="mx-auto max-w-2xl px-4 py-16 text-center">
          <h1 className="text-2xl font-bold">Admin access required</h1>
          <p className="mt-2 text-muted-foreground">Your account does not have CMS permissions.</p>
        </main>
      </>
    );
  }

  const selectedCourse = courses.data?.find((course) => course.id === selectedCourseId);

  const chooseCourse = (id: string) => {
    setSelectedCourseId(id);
    setEditingModuleId(null);
    setModuleDraft({ title: "", order: "1", content: "", duration: "30", parentModuleId: "", prerequisiteModuleId: "", videoUrls: [""], imageUrl: "" });
    setQuizDraft((draft) => ({ ...draft, moduleId: "" }));
    const course = courses.data?.find((item) => item.id === id);
    if (course) {
      setCourseDraft({
        title: course.title,
        description: course.description,
        enrollmentMode: course.enrollmentMode,
        instructorId: isSuperAdmin(user?.role) ? (course.instructorId || "") : user?.id || "",
        thumbnail: course.thumbnail || "",
        isPublished: !!course.isPublished,
      });
    }
  };

  const visibleCourseOptions = useMemo(
    () => (courses.data || []).filter((course) => isSuperAdmin(user?.role) || !course.instructorId || course.instructorId === user?.id),
    [courses.data, user?.id, user?.role],
  );
  const visibleNavItems = navItems.filter((item) =>
    (item.id !== "payments" || canReviewPayments(user?.role))
    && (item.id !== "partnerships" || isSuperAdmin(user?.role))
  );

  return (
    <div className="min-h-screen bg-muted/20">
      <Navbar />
      <main className="mx-auto flex max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <aside className="hidden w-52 shrink-0 md:block">
          <div className="sticky top-24 space-y-1">
            <p className="mb-4 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">CMS workspace</p>
            {visibleNavItems.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setSection(id)}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-medium ${section === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
                aria-label={id === "partnerships" && unreadPartnershipCount > 0 ? `${label}, ${unreadPartnershipCount} new submissions` : label}
              >
                <Icon className="h-4 w-4" />
                {label}
                {id === "partnerships" && unreadPartnershipCount > 0 && (
                  <Badge variant="destructive" className="ml-auto min-w-5 justify-center px-1.5">
                    {unreadPartnershipCount > 99 ? "99+" : unreadPartnershipCount}
                  </Badge>
                )}
              </button>
            ))}
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="mb-8 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-primary">Workspace management</p>
              <h1 className="mt-1 text-3xl font-bold text-foreground">{navItems.find((item) => item.id === section)?.label}</h1>
              <p className="mt-2 text-muted-foreground">Manage learning content, access, and student progress.</p>
            </div>
            <select className="h-10 rounded-md border bg-background px-3 text-sm md:hidden" value={section} onChange={(event) => setSection(event.target.value as Section)}>
              {visibleNavItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}{item.id === "partnerships" && unreadPartnershipCount > 0 ? ` (${unreadPartnershipCount} new)` : ""}
                </option>
              ))}
            </select>
          </div>

          {section === "overview" && <Overview analytics={analytics.data} courses={courses.data || []} users={users.data || []} onSection={setSection} />}

          {section === "courses" && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Create a new course</CardTitle>
                  <CardDescription>Set the course access rules first, then add modules from the Modules section.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <Field label="Title">
                    <Input value={newCourseDraft.title} onChange={(e) => setNewCourseDraft({ ...newCourseDraft, title: e.target.value })} placeholder="Course title" />
                  </Field>

                  <Field label="Description">
                    <Input value={newCourseDraft.description} onChange={(e) => setNewCourseDraft({ ...newCourseDraft, description: e.target.value })} />
                  </Field>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Enrollment mode">
                      <select className="h-10 rounded-md border bg-background px-3 text-sm" value={newCourseDraft.enrollmentMode} onChange={(e) => setNewCourseDraft({ ...newCourseDraft, enrollmentMode: e.target.value })}>
                        <option value="self">Self-enrollment</option>
                        <option value="restricted">Instructor enrollment</option>
                      </select>
                    </Field>

                    <Field label="Instructor">
                      <select className="h-10 rounded-md border bg-background px-3 text-sm" value={newCourseDraft.instructorId} onChange={(e) => setNewCourseDraft({ ...newCourseDraft, instructorId: e.target.value })}>
                        <option value="">Unassigned</option>
                        {(users.data || []).filter((account) => ["admin", "super_admin", "instructor"].includes(account.role)).map((account) => (
                          <option key={account.id} value={account.id}>{account.fullName}</option>
                        ))}
                      </select>
                    </Field>
                  </div>

                  <Field label="Thumbnail URL">
                    <Input value={newCourseDraft.thumbnail} onChange={(e) => setNewCourseDraft({ ...newCourseDraft, thumbnail: e.target.value })} />
                  </Field>

                  <Button disabled={createCourse.isPending} onClick={() => createCourse.mutate()}>
                    Create course and add modules
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Course catalog</CardTitle>
                  <CardDescription>Published courses are visible to students. Instructors can manage only their own assigned courses.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {visibleCourseOptions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No courses available yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {visibleCourseOptions.map((course) => (
                        <div key={course.id} className="rounded-lg border bg-background p-4">
                          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium">{course.title}</p>
                                <Badge variant={course.isPublished ? "default" : "secondary"}>{course.isPublished ? "Published" : "Draft"}</Badge>
                              </div>
                              <p className="mt-1 text-sm text-muted-foreground">{course.description}</p>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <Button variant="secondary" size="sm" onClick={() => chooseCourse(course.id)}>
                                Edit
                              </Button>
                              <Button
                                variant={course.isPublished ? "outline" : "default"}
                                size="sm"
                                onClick={() => {
                                  setSelectedCourseId(course.id);
                                  setCourseDraft((draft) => ({ ...draft, isPublished: !!course.isPublished }));
                                  publishCourse.mutate();
                                }}
                              >
                                {course.isPublished ? "Unpublish" : "Publish"}
                              </Button>
                              {(isSuperAdmin(user?.role) || course.instructorId === user?.id) && (
                                <Button variant="destructive" size="sm" onClick={() => deleteCourse.mutate(course.id)}>
                                  <Trash2 className="mr-2 h-4 w-4" />Delete
                                </Button>
                              )}

                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {selectedCourse && (
                <Card ref={courseEditorRef}>
                  <CardHeader>
                    <CardTitle>Edit course</CardTitle>
                    <CardDescription>Update the course details and publish it once it is ready for students.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <Field label="Title">
                      <Input value={courseDraft.title} onChange={(e) => setCourseDraft({ ...courseDraft, title: e.target.value })} />
                    </Field>

                    <Field label="Description">
                      <Input value={courseDraft.description} onChange={(e) => setCourseDraft({ ...courseDraft, description: e.target.value })} />
                    </Field>

                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="Enrollment mode">
                        <select className="h-10 rounded-md border bg-background px-3 text-sm" value={courseDraft.enrollmentMode} onChange={(e) => setCourseDraft({ ...courseDraft, enrollmentMode: e.target.value })}>
                          <option value="self">Self-enrollment</option>
                          <option value="restricted">Instructor enrollment</option>
                        </select>
                      </Field>

                      {!isSuperAdmin(user?.role) ? (
                        <Field label="Course instructor">
                          <Input value={user?.fullName || "Current instructor"} disabled />
                        </Field>
                      ) : (
                        <Field label="Instructor">
                          <select className="h-10 rounded-md border bg-background px-3 text-sm" value={courseDraft.instructorId} onChange={(e) => setCourseDraft({ ...courseDraft, instructorId: e.target.value })}>
                            <option value="">Unassigned</option>
                            {(users.data || []).filter((account) => ["admin", "super_admin", "instructor"].includes(account.role)).map((account) => (
                              <option key={account.id} value={account.id}>{account.fullName}</option>
                            ))}
                          </select>
                        </Field>
                      )}
                    </div>

                    <Field label="Thumbnail URL">
                      <Input value={courseDraft.thumbnail} onChange={(e) => setCourseDraft({ ...courseDraft, thumbnail: e.target.value })} />
                    </Field>

                    <div className="flex flex-wrap gap-3">
                      <Button onClick={() => saveCourse.mutate()} disabled={saveCourse.isPending}>Save details</Button>
                      <Button variant={courseDraft.isPublished ? "outline" : "default"} onClick={() => publishCourse.mutate()} disabled={publishCourse.isPending}>
                        {courseDraft.isPublished ? "Unpublish course" : "Publish course"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {section === "modules" && (
            <ModulePanel
              courses={visibleCourseOptions}
              selectedCourseId={selectedCourseId}
              chooseCourse={chooseCourse}
              modules={modules.data?.filter((module) => module.courseId === selectedCourseId) || []}
              draft={moduleDraft}
              setDraft={setModuleDraft}
              editingModuleId={editingModuleId}
              setEditingModuleId={setEditingModuleId}
              onSave={() => saveModule.mutate()}
              pending={saveModule.isPending}
            />
          )}

          {section === "quizzes" && (
            <QuizPanel
              courses={visibleCourseOptions}
              selectedCourseId={selectedCourseId}
              chooseCourse={(id: string) => {
                chooseCourse(id);
                setQuizDraft((draft) => ({ ...draft, moduleId: "" }));
              }}
              modules={modules.data || []}
              quizzes={quizzes.data || []}
              draft={quizDraft}
              setDraft={setQuizDraft}
              editingQuizId={editingQuizId}
              onEdit={(quiz: QuizRecord) => {
                setEditingQuizId(quiz.id);
                setQuizDraft({
                  moduleId: quiz.moduleId,
                  title: quiz.title,
                  passScore: String(quiz.passScore),
                  questions: quiz.questions.map((question) => ({
                    id: question.id,
                    question: question.question,
                    questionImageUrl: question.questionImageUrl || "",
                    explanation: question.explanation || "",
                    explanationImageUrl: question.explanationImageUrl || "",
                    options: question.options,
                    correctAnswer: String(question.correctAnswer),
                  })),
                });
              }}
              onCancelEdit={() => {
                setEditingQuizId(null);
                setQuizDraft({ moduleId: "", title: "", passScore: "70", questions: [createEmptyQuizQuestion()] });
              }}
              onSave={() => saveQuiz.mutate()}
              onDelete={(id: string) => deleteQuiz.mutate(id)}
              pending={saveQuiz.isPending}
            />
          )}

          {section === "events" && (
            <EventManagementPanel userId={adminId} canManageAll={isSuperAdmin(user.role)} />
          )}

          {section === "cbt" && (
            <CbtQuestionBankPanel userId={adminId} canManageAll={isSuperAdmin(user.role)} />
          )}

          {section === "users" && (
            <UsersPanel
              users={users.data || []}
              canCreateInstructor={isSuperAdmin(user.role)}
              draft={instructorDraft}
              setDraft={setInstructorDraft}
              onCreate={() => createInstructor.mutate()}
              pending={createInstructor.isPending}
              createdInstructor={createdInstructor}
            />
          )}

          {section === "enrollments" && (
            <EnrollmentPanel
              users={users.data || []}
              courses={courses.data || []}
              value={enrollment}
              setValue={setEnrollment}
              onEnroll={() => enroll.mutate()}
              onRemove={() => removeEnrollment.mutate()}
              onReset={() => resetProgress.mutate()}
            />
          )}

          {section === "progress" && (
            <LearnerProgressPanel
              courses={courses.data || []}
              selectedCourseId={selectedCourseId}
              onCourseChange={setSelectedCourseId}
              data={learnerProgress.data}
              isLoading={learnerProgress.isLoading}
              isError={learnerProgress.isError}
            />
          )}

          {section === "analytics" && <AnalyticsPanel data={analytics.data} />}

          {section === "announcements" && (
            <AnnouncementPanel
              announcementDraft={announcementDraft}
              setAnnouncementDraft={setAnnouncementDraft}
              announcements={announcementFeed.data || []}
              onCreate={() => createAnnouncement.mutate()}
            />
          )}

          {section === "payments" && canReviewPayments(user?.role) && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Manual bank-transfer reviews</CardTitle>
                  <CardDescription>Verify each transfer against the bank record before approving. Approval grants the selected subscription and access to published courses.</CardDescription>
                </CardHeader>
              </Card>
              {manualPayments.isPending && <p className="text-sm text-muted-foreground">Loading transfer submissions...</p>}
              {manualPayments.isError && <p className="text-sm text-destructive">Unable to load payment submissions. Refresh to try again.</p>}
              {!manualPayments.isPending && !manualPayments.isError && manualPayments.data?.length === 0 && (
                <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No bank-transfer submissions yet.</CardContent></Card>
              )}
              {manualPayments.data?.map((payment) => (
                <Card key={payment.id}>
                  <CardContent className="space-y-4 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{payment.user?.full_name || "Learner"}</p>
                        <p className="text-sm text-muted-foreground">{payment.user?.email || payment.user_id}</p>
                      </div>
                      <Badge variant={payment.status === "pending" ? "secondary" : payment.status === "approved" ? "default" : "destructive"}>
                        {payment.status}
                      </Badge>
                    </div>
                    <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                      <div><dt className="text-muted-foreground">Plan / amount</dt><dd className="font-medium capitalize">{payment.plan} · ₦{Number(payment.amount).toLocaleString("en-NG")}</dd></div>
                      <div><dt className="text-muted-foreground">Transferred to</dt><dd className="font-medium">{payment.bank_name}</dd></div>
                      <div><dt className="text-muted-foreground">Transaction reference</dt><dd className="break-all font-medium">{payment.bank_reference}</dd></div>
                      <div><dt className="text-muted-foreground">Submitted</dt><dd>{new Date(payment.created_at).toLocaleString("en-NG")}</dd></div>
                    </dl>
                    {payment.review_note && (
                      <p className="rounded-md bg-muted p-3 text-sm"><span className="font-medium">Review note:</span> {payment.review_note}</p>
                    )}
                    {payment.status === "pending" && (
                      <div className="space-y-3 border-t pt-4">
                        <Input
                          aria-label={`Review note for ${payment.user?.email || payment.id}`}
                          placeholder="Optional note (required context for rejection is recommended)"
                          value={paymentReviewNotes[payment.id] || ""}
                          onChange={(event) => setPaymentReviewNotes((notes) => ({ ...notes, [payment.id]: event.target.value }))}
                          maxLength={500}
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            disabled={reviewManualPayment.isPending}
                            onClick={() => reviewManualPayment.mutate({ id: payment.id, decision: "approved" })}
                          >
                            Approve and grant access
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            disabled={reviewManualPayment.isPending}
                            onClick={() => reviewManualPayment.mutate({ id: payment.id, decision: "rejected" })}
                          >
                            Reject transfer
                          </Button>
                        </div>
                      </div>
                    )}

                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {section === "partnerships" && isSuperAdmin(user?.role) && (
            <PartnershipInterestPanel
              submissions={partnershipInterests.data || []}
              isLoading={partnershipInterests.isLoading}
              isError={partnershipInterests.isError}
              onRefresh={() => partnershipInterests.refetch()}
              organizationSubmissions={organizationPartnershipInterests.data || []}
              organizationsLoading={organizationPartnershipInterests.isLoading}
              organizationsError={organizationPartnershipInterests.isError}
              onRefreshOrganizations={() => organizationPartnershipInterests.refetch()}
            />
          )}
        </div>
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function CourseSelect({ courses, value, onChange }: { courses: Course[]; value: string; onChange: (value: string) => void }) {
  return (
    <Field label="Course">
      <select className="h-10 w-full rounded-md border bg-background px-3 text-sm text-foreground" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="" className="bg-background text-foreground">Choose a course</option>
        {courses.map((course) => (
          <option key={course.id} value={course.id} className="bg-background text-foreground">{course.title}</option>
        ))}
      </select>
    </Field>
  );
}

function Overview({ courses, users, onSection }: { analytics?: Analytics; courses: Course[]; users: Omit<User, "password">[]; onSection: (section: Section) => void }) {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      {[ ["Courses", courses.length, "courses"], ["Users", users.length, "users"], ["Published", courses.filter((course) => course.isPublished).length, "courses"] ].map(([label, value, target]) => (
        <button key={label as string} type="button" onClick={() => onSection(target === "users" ? "users" : "courses")} className="text-left">
          <Card className="transition-colors hover:bg-muted">
            <CardHeader>
              <CardDescription>{label as string}</CardDescription>
              <CardTitle className="text-3xl">{String(value)}</CardTitle>
            </CardHeader>
          </Card>
        </button>
      ))}
    </div>
  );
}

function ModulePanel({ courses, selectedCourseId, chooseCourse, modules, draft, setDraft, editingModuleId, setEditingModuleId, onSave, pending }: any) {
  const courseModules = modules.filter((module: Module) => module.courseId === selectedCourseId);
  const topLevelModules = courseModules.filter((module: Module) => !module.parentModuleId);
  const childModules = (parentId: string) => courseModules.filter((module: Module) => module.parentModuleId === parentId);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{editingModuleId ? "Edit module" : "Create module"}</CardTitle>
          <CardDescription>Create content with duration, media, ordering, and prerequisites.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <CourseSelect courses={courses} value={selectedCourseId} onChange={chooseCourse} />

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Title">
              <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            </Field>
            <Field label="Order">
              <Input type="number" min="1" value={draft.order} onChange={(e) => setDraft({ ...draft, order: e.target.value })} />
            </Field>
          </div>

          <Field label="Content">
            <QuizMarkdownEditor value={draft.content} onChange={(content) => setDraft({ ...draft, content })} placeholder="Write the lesson. Paste lists or LaTeX equations here." minHeight="min-h-56" enableImageInsert />
          </Field>
          <div className="-mt-2 space-y-2">
            <p className="text-sm text-muted-foreground">Preview the English narration using voices available in your browser. The student audio player reads the saved lesson text.</p>
            <LessonSpeechControls source={draft.content} />
          </div>

          <Field label="Additional module image URL (optional)">
            <Input
              type="url"
              value={draft.imageUrl}
              onChange={(event) => setDraft({ ...draft, imageUrl: event.target.value })}
              placeholder="https://example.com/lesson-image.png"
            />
          </Field>
          <p className="-mt-3 text-sm text-muted-foreground">
            This image appears after the lesson text. Use the image controls in Content to place an image inline.
          </p>
          {draft.imageUrl.trim() && (
            <img src={draft.imageUrl} alt="Module image preview" className="max-h-56 max-w-full rounded-md border object-contain" />
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Duration (minutes)">
              <Input type="number" min="1" value={draft.duration} onChange={(e) => setDraft({ ...draft, duration: e.target.value })} />
            </Field>

            <Field label="Prerequisite">
              <select className="h-10 rounded-md border bg-background px-3 text-sm" value={draft.prerequisiteModuleId} onChange={(e) => setDraft({ ...draft, prerequisiteModuleId: e.target.value })}>
                <option value="">None</option>
                {courseModules.filter((module: Module) => module.id !== editingModuleId).map((m: Module) => (
                  <option key={m.id} value={m.id}>{m.order}. {m.title}</option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Parent module">
              <select className="h-10 rounded-md border bg-background px-3 text-sm" value={draft.parentModuleId} onChange={(e) => setDraft({ ...draft, parentModuleId: e.target.value })}>
                <option value="">Top-level module</option>
                {topLevelModules.filter((module: Module) => module.id !== editingModuleId).map((m: Module) => (
                  <option key={m.id} value={m.id}>{m.order}. {m.title}</option>
                ))}
              </select>
            </Field>
            <div className="space-y-2">
              <Label>Video links (YouTube)</Label>
              <div className="space-y-3">
                {draft.videoUrls.map((videoUrl: string, index: number) => (
                  <div key={index} className="flex min-w-0 items-center gap-2">
                    <Input
                      className="min-w-0 flex-1"
                      type="url"
                      value={videoUrl}
                      onChange={(event) => setDraft({
                        ...draft,
                        videoUrls: draft.videoUrls.map((value: string, videoIndex: number) => videoIndex === index ? event.target.value : value),
                      })}
                      placeholder="https://www.youtube.com/watch?v=..."
                      aria-label={`YouTube video link ${index + 1}`}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label={`Remove video link ${index + 1}`}
                      disabled={draft.videoUrls.length === 1}
                      onClick={() => setDraft({
                        ...draft,
                        videoUrls: draft.videoUrls.filter((_: string, videoIndex: number) => videoIndex !== index),
                      })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDraft({ ...draft, videoUrls: [...draft.videoUrls, ""] })}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add video link
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button disabled={pending || !selectedCourseId} onClick={onSave}>
              {pending ? "Saving..." : editingModuleId ? "Save module" : "Create module"}
            </Button>
            {editingModuleId && (
              <Button
                variant="outline"
                onClick={() => {
                  setEditingModuleId(null);
                  setDraft({ title: "", order: "1", content: "", duration: "30", parentModuleId: "", prerequisiteModuleId: "", videoUrls: [""], imageUrl: "" });
                }}
              >
                Cancel edit
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Saved module tree</CardTitle>
          <CardDescription>Select Edit to load an existing module back into the form.</CardDescription>
        </CardHeader>
        <CardContent>
          {!selectedCourseId ? (
            <p className="text-sm text-muted-foreground">Choose a course first.</p>
          ) : topLevelModules.length === 0 ? (
            <p className="text-sm text-muted-foreground">No modules have been saved for this course.</p>
          ) : (
            <div className="space-y-3">
              {topLevelModules.map((module: Module) => (
                <div key={module.id} className="rounded-md border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{module.order}. {module.title}</p>
                      <p className="text-xs text-muted-foreground">{module.duration} minutes{(module.videoUrls?.length || module.videoUrl) ? ` · ${module.videoUrls?.length || 1} video${(module.videoUrls?.length || 1) === 1 ? "" : "s"}` : ""}</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => {
                      setEditingModuleId(module.id);
                      setDraft({
                        title: module.title,
                        order: String(module.order),
                        content: module.content,
                        duration: String(module.duration),
                        parentModuleId: module.parentModuleId || "",
                        prerequisiteModuleId: module.prerequisiteModuleId || "",
                        videoUrls: module.videoUrls?.length ? module.videoUrls : module.videoUrl ? [module.videoUrl] : [""],
                        imageUrl: module.imageUrl || "",
                      });
                    }}>Edit</Button>
                  </div>
                  {childModules(module.id).length > 0 && (
                    <div className="ml-5 mt-3 space-y-2 border-l pl-4">
                      {childModules(module.id).map((child: Module) => (
                        <div key={child.id} className="flex items-center justify-between gap-3 rounded-md bg-muted/40 p-2">
                          <div>
                            <p className="text-sm font-medium">{child.order}. {child.title}</p>
                            <p className="text-xs text-muted-foreground">{child.duration} minutes{child.prerequisiteModuleId ? " · prerequisite set" : ""}</p>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => {
                            setEditingModuleId(child.id);
                            setDraft({
                              title: child.title,
                              order: String(child.order),
                              content: child.content,
                              duration: String(child.duration),
                              parentModuleId: child.parentModuleId || "",
                              prerequisiteModuleId: child.prerequisiteModuleId || "",
                              videoUrls: child.videoUrls?.length ? child.videoUrls : child.videoUrl ? [child.videoUrl] : [""],
                              imageUrl: child.imageUrl || "",
                            });
                          }}>Edit</Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function createEmptyCbtQuestionDraft(): CbtQuestionDraft {
  return {
    examType: "",
    subject: "",
    examYear: String(new Date().getFullYear()),
    topic: "",
    question: "",
    questionImageUrl: "",
    options: ["", "", "", ""],
    correctAnswer: "1",
    explanation: "",
    explanationImageUrl: "",
  };
}

function CbtQuestionBankPanel({ userId, canManageAll }: { userId: string; canManageAll: boolean }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<CbtQuestionDraft>(createEmptyCbtQuestionDraft);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "published" | "archived">("all");
  const [examTypeFilter, setExamTypeFilter] = useState<"all" | CbtExamType | "uncategorized">("all");
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [bulkExamType, setBulkExamType] = useState<CbtExamType | "">("");
  const [bulkTopic, setBulkTopic] = useState("");
  const [csvPreview, setCsvPreview] = useState<QuizCsvPreview | null>(null);
  const [csvFileName, setCsvFileName] = useState("");

  const questionsQuery = useQuery<CbtQuestionRecord[]>({
    queryKey: ["/api/admin/cbt/questions", userId],
    queryFn: () => apiRequest("GET", "/api/admin/cbt/questions"),
  });

  const questions = questionsQuery.data ?? [];
  const subjects = Array.from(new Set(questions.map((question) => question.subject))).sort((a, b) => a.localeCompare(b));
  const years = Array.from(new Set(questions.map((question) => question.examYear))).sort((a, b) => b - a);
  const filteredQuestions = questions.filter((question) =>
    (examTypeFilter === "all" || (examTypeFilter === "uncategorized" ? !question.examType || !question.topic : question.examType === examTypeFilter))
    &&
    (subjectFilter === "all" || question.subject === subjectFilter)
    && (yearFilter === "all" || question.examYear === Number(yearFilter))
    && (statusFilter === "all" || question.status === statusFilter),
  );

  const resetDraft = () => {
    setDraft(createEmptyCbtQuestionDraft());
    setEditingQuestionId(null);
  };

  const saveQuestion = useMutation({
    mutationFn: () => {
      if (!draft.examType) throw new Error("Choose an exam category.");
      const payload = {
        examType: draft.examType,
        subject: draft.subject,
        examYear: Number(draft.examYear),
        topic: draft.topic,
        question: draft.question,
        questionImageUrl: draft.questionImageUrl.trim() || undefined,
        options: draft.options,
        correctAnswer: Number(draft.correctAnswer),
        explanation: draft.explanation.trim() || undefined,
        explanationImageUrl: draft.explanationImageUrl.trim() || undefined,
      };
      return apiRequest(
        editingQuestionId ? "PATCH" : "POST",
        editingQuestionId ? `/api/admin/cbt/questions/${editingQuestionId}` : "/api/admin/cbt/questions",
        payload,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cbt/questions", userId] });
      toast({
        title: editingQuestionId ? "Question updated" : "Question saved as draft",
        description: editingQuestionId && questions.find((question) => question.id === editingQuestionId)?.status === "published"
          ? "The edited question returned to draft and must be reviewed before publishing."
          : undefined,
      });
      resetDraft();
    },
    onError: (error: Error) => toast({ title: "Could not save question", description: error.message, variant: "destructive" }),
  });

  const importQuestions = useMutation({
    mutationFn: () => {
      if (!csvPreview || csvPreview.issues.length || !csvPreview.questions.length) {
        throw new Error("Resolve all CSV issues before importing.");
      }
      if (!draft.examType || !draft.subject.trim() || !draft.examYear || !draft.topic.trim()) {
        throw new Error("Choose an exam category, subject, year, and topic in the question form before importing.");
      }
      return apiRequest("POST", "/api/admin/cbt/questions/import", {
        examType: draft.examType,
        subject: draft.subject,
        examYear: Number(draft.examYear),
        topic: draft.topic,
        questions: csvPreview.questions.map((question) => ({
          question: question.question,
          questionImageUrl: question.questionImageUrl || undefined,
          options: question.options,
          correctAnswer: Number(question.correctAnswer),
          explanation: question.explanation || undefined,
          explanationImageUrl: question.explanationImageUrl || undefined,
        })),
      });
    },
    onSuccess: (result: { imported: number }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cbt/questions", userId] });
      setCsvPreview(null);
      setCsvFileName("");
      toast({ title: "Questions imported as drafts", description: `${result.imported} question${result.imported === 1 ? "" : "s"} added to the question bank.` });
    },
    onError: (error: Error) => toast({ title: "Import failed", description: error.message, variant: "destructive" }),
  });

  const updateQuestionStatus = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "publish" | "archive" | "restore" }) =>
      apiRequest("POST", `/api/admin/cbt/questions/${id}/${action}`),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cbt/questions", userId] });
      const titles = { publish: "Question published", archive: "Question archived", restore: "Question restored as draft" };
      toast({ title: titles[variables.action] });
    },
    onError: (error: Error) => toast({ title: "Could not update question status", description: error.message, variant: "destructive" }),
  });

  const bulkClassify = useMutation({
    mutationFn: () => {
      if (!selectedQuestionIds.length) throw new Error("Select at least one question.");
      if (!bulkExamType) throw new Error("Choose an exam category.");
      if (!bulkTopic.trim()) throw new Error("Enter the topic for the selected questions.");
      return apiRequest("POST", "/api/admin/cbt/questions/bulk-classify", {
        ids: selectedQuestionIds,
        examType: bulkExamType,
        topic: bulkTopic.trim(),
      });
    },
    onSuccess: (result: { updated: number }) => {
      setSelectedQuestionIds([]);
      setBulkTopic("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cbt/questions", userId] });
      toast({ title: "Questions reclassified", description: `${result.updated} question${result.updated === 1 ? "" : "s"} updated.` });
    },
    onError: (error: Error) => toast({ title: "Could not reclassify questions", description: error.message, variant: "destructive" }),
  });

  const handleCsvFile = async (file?: File) => {
    setCsvPreview(null);
    setCsvFileName(file?.name || "");
    if (!file) return;
    if (file.size > 1024 * 1024) {
      setCsvPreview({ questions: [], issues: [{ row: 1, message: "CSV files must be 1 MB or smaller." }] });
      return;
    }
    try {
      setCsvPreview(parseQuizCsv(await file.text()));
    } catch (error) {
      setCsvPreview({
        questions: [],
        issues: [{ row: 1, message: error instanceof Error ? `Could not read CSV: ${error.message}` : "Could not read this CSV file." }],
      });
    }
  };

  const downloadCsvTemplate = () => {
    const template = [
      "question,option_a,option_b,option_c,option_d,correct_answer,explanation,question_image_url,explanation_image_url",
      '"What is 2 + 2?","3","4","5","6","B","Basic addition","",""',
    ].join("\r\n");
    const url = URL.createObjectURL(new Blob([template], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "learnpedia-cbt-questions-template.csv";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const editQuestion = (question: CbtQuestionRecord) => {
    setEditingQuestionId(question.id);
    setDraft({
      examType: question.examType ?? "",
      subject: question.subject,
      examYear: String(question.examYear),
      topic: question.topic ?? "",
      question: question.question,
      questionImageUrl: question.questionImageUrl || "",
      options: question.options,
      correctAnswer: String(question.correctAnswer),
      explanation: question.explanation || "",
      explanationImageUrl: question.explanationImageUrl || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{editingQuestionId ? "Edit CBT question" : "Add a CBT question"}</CardTitle>
          <CardDescription>
            Organize each question by exam category, subject, year, and topic. New and imported questions are saved as drafts and are not available to students until published.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              saveQuestion.mutate();
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Exam category">
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={draft.examType}
                  onChange={(event) => setDraft({ ...draft, examType: event.target.value as CbtQuestionDraft["examType"] })}
                  required
                >
                  <option value="">Choose exam category</option>
                  <option value="jamb">JAMB/UTME</option>
                  <option value="waec">WAEC/NECO</option>
                </select>
              </Field>
              <Field label="Subject">
                <Input value={draft.subject} onChange={(event) => setDraft({ ...draft, subject: event.target.value })} placeholder="e.g. Mathematics" maxLength={80} required />
              </Field>
              <Field label="Exam year">
                <Input type="number" min="1950" max="2100" value={draft.examYear} onChange={(event) => setDraft({ ...draft, examYear: event.target.value })} required />
              </Field>
              <Field label="Topic">
                <Input value={draft.topic} onChange={(event) => setDraft({ ...draft, topic: event.target.value })} placeholder="e.g. Algebra" maxLength={120} required />
              </Field>
            </div>
            <Field label="Question">
              <Textarea value={draft.question} onChange={(event) => setDraft({ ...draft, question: event.target.value })} rows={4} maxLength={10000} required />
            </Field>
            <Field label="Question image URL (optional)">
              <Input type="url" value={draft.questionImageUrl} onChange={(event) => setDraft({ ...draft, questionImageUrl: event.target.value })} placeholder="https://example.com/image.png" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              {draft.options.map((option, index) => (
                <Field key={index} label={`Option ${String.fromCharCode(65 + index)}`}>
                  <Input
                    value={option}
                    onChange={(event) => setDraft({
                      ...draft,
                      options: draft.options.map((current, optionIndex) => optionIndex === index ? event.target.value : current),
                    })}
                    maxLength={2000}
                    required
                  />
                </Field>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Correct answer">
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={draft.correctAnswer}
                  onChange={(event) => setDraft({ ...draft, correctAnswer: event.target.value })}
                >
                  {["A", "B", "C", "D"].map((letter, index) => <option key={letter} value={index + 1}>{letter}</option>)}
                </select>
              </Field>
              <Field label="Explanation image URL (optional)">
                <Input type="url" value={draft.explanationImageUrl} onChange={(event) => setDraft({ ...draft, explanationImageUrl: event.target.value })} placeholder="https://example.com/explanation.png" />
              </Field>
            </div>
            <Field label="Explanation (optional)">
              <Textarea value={draft.explanation} onChange={(event) => setDraft({ ...draft, explanation: event.target.value })} rows={3} maxLength={10000} />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={saveQuestion.isPending}>
                {saveQuestion.isPending ? "Saving..." : editingQuestionId ? "Save changes" : "Save as draft"}
              </Button>
              {editingQuestionId && <Button type="button" variant="outline" onClick={resetDraft}><X className="mr-2 h-4 w-4" />Cancel edit</Button>}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Import questions from CSV</CardTitle>
          <CardDescription>Choose the exam category, subject, year, and topic above first. Every imported row is validated and saved as a draft; no question is published automatically.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Required columns: question, option_a through option_d, and correct_answer (A-D or 1-4). Explanations and image URLs are optional. Maximum file size is 1 MB and 200 questions per import.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={downloadCsvTemplate}><Download className="mr-2 h-4 w-4" />Download template</Button>
            <Label htmlFor="cbt-csv-upload" className="inline-flex min-h-8 cursor-pointer items-center justify-center rounded-md border bg-background px-3 text-xs font-medium hover:bg-accent">
              <FileUp className="mr-2 h-4 w-4" />Choose CSV
            </Label>
            <Input id="cbt-csv-upload" type="file" accept=".csv,text/csv" className="sr-only" onChange={(event) => void handleCsvFile(event.target.files?.[0])} />
          </div>
          {csvFileName && <p className="text-xs text-muted-foreground">Selected file: {csvFileName}</p>}
          {csvPreview && (
            <div className="space-y-3 rounded-md border bg-muted/20 p-3" aria-live="polite">
              {csvPreview.issues.length > 0 ? (
                <>
                  <p className="font-medium text-destructive">Import blocked: fix all CSV errors before importing. {csvPreview.questions.length} valid rows found, but none have been saved.</p>
                  <ul className="max-h-48 space-y-1 overflow-y-auto text-sm">
                    {csvPreview.issues.map((issue, index) => <li key={`${issue.row}-${index}`} className="text-destructive">Row {issue.row}: {issue.message}</li>)}
                  </ul>
                </>
              ) : (
                <>
                  <p className="font-medium text-emerald-700 dark:text-emerald-300">{csvPreview.questions.length} questions passed validation. They will be saved as drafts for {draft.subject || "the selected subject"} ({draft.examYear}).</p>
                  <div className="max-h-48 space-y-2 overflow-y-auto">
                    {csvPreview.questions.slice(0, 5).map((question, index) => (
                      <div key={question.id} className="rounded-md border bg-background p-2 text-sm">
                        <p className="font-medium">{index + 1}. {question.question}</p>
                        <p className="mt-1 text-muted-foreground">Correct option: {["A", "B", "C", "D"][Number(question.correctAnswer) - 1]}</p>
                      </div>
                    ))}
                    {csvPreview.questions.length > 5 && <p className="text-xs text-muted-foreground">And {csvPreview.questions.length - 5} more...</p>}
                  </div>
                  <Button type="button" disabled={importQuestions.isPending || !draft.subject.trim() || !draft.examYear} onClick={() => importQuestions.mutate()}>
                    {importQuestions.isPending ? "Importing..." : `Import ${csvPreview.questions.length} drafts`}
                  </Button>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Question bank</CardTitle>
          <CardDescription>
            {canManageAll ? "Review questions from instructors and manage the shared bank." : "You can manage questions that you created. Publish only after reviewing their subject, year, answer, and explanation."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <select className="h-10 rounded-md border bg-background px-3 text-sm" aria-label="Filter by exam category" value={examTypeFilter} onChange={(event) => setExamTypeFilter(event.target.value as typeof examTypeFilter)}>
              <option value="all">All exam categories</option>
              <option value="uncategorized">Needs classification</option>
              <option value="jamb">JAMB/UTME</option>
              <option value="waec">WAEC/NECO</option>
            </select>
            <select className="h-10 rounded-md border bg-background px-3 text-sm" aria-label="Filter by subject" value={subjectFilter} onChange={(event) => setSubjectFilter(event.target.value)}>
              <option value="all">All subjects</option>
              {subjects.map((subject) => <option key={subject} value={subject}>{subject}</option>)}
            </select>
            <select className="h-10 rounded-md border bg-background px-3 text-sm" aria-label="Filter by exam year" value={yearFilter} onChange={(event) => setYearFilter(event.target.value)}>
              <option value="all">All years</option>
              {years.map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
            <select className="h-10 rounded-md border bg-background px-3 text-sm" aria-label="Filter by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
              <option value="all">All statuses</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          {questionsQuery.isPending && <p className="text-sm text-muted-foreground">Loading questions...</p>}
          {questionsQuery.isError && <p className="text-sm text-destructive">Could not load the CBT question bank. Refresh to try again.</p>}
          {!questionsQuery.isPending && !questionsQuery.isError && filteredQuestions.length === 0 && (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No questions match these filters yet.</p>
          )}
          {filteredQuestions.length > 0 && (
            <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={filteredQuestions.every((question) => selectedQuestionIds.includes(question.id))}
                  onChange={(event) => setSelectedQuestionIds((current) => event.target.checked
                    ? Array.from(new Set([...current, ...filteredQuestions.map((question) => question.id)]))
                    : current.filter((id) => !filteredQuestions.some((question) => question.id === id)))}
                />
                Select all {filteredQuestions.length} visible questions
              </label>
              <p className="text-sm text-muted-foreground">Bulk assign a category and topic to existing questions, including uncategorized questions.</p>
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                <select
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                  value={bulkExamType}
                  onChange={(event) => setBulkExamType(event.target.value as CbtExamType | "")}
                  aria-label="Bulk exam category"
                >
                  <option value="">Choose exam category</option>
                  <option value="jamb">JAMB/UTME</option>
                  <option value="waec">WAEC/NECO</option>
                </select>
                <Input value={bulkTopic} onChange={(event) => setBulkTopic(event.target.value)} placeholder="Topic for selected questions" maxLength={120} />
                <Button
                  type="button"
                  variant="outline"
                  disabled={!selectedQuestionIds.length || bulkClassify.isPending}
                  onClick={() => bulkClassify.mutate()}
                >
                  {bulkClassify.isPending ? "Updating..." : `Classify ${selectedQuestionIds.length}`}
                </Button>
              </div>
            </div>
          )}
          <div className="space-y-3">
            {filteredQuestions.map((question) => (
              <article key={question.id} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedQuestionIds.includes(question.id)}
                        onChange={(event) => setSelectedQuestionIds((current) => event.target.checked
                          ? [...current, question.id]
                          : current.filter((id) => id !== question.id))}
                        aria-label={`Select question for ${question.subject}, ${question.examYear}`}
                      />
                      <Badge variant={question.status === "published" ? "default" : question.status === "archived" ? "destructive" : "secondary"}>{question.status}</Badge>
                      <Badge variant="outline">{question.examType === "jamb" ? "JAMB/UTME" : question.examType === "waec" ? "WAEC/NECO" : "Uncategorized"}</Badge>
                      <span className="text-xs font-medium text-muted-foreground">{question.subject} · {question.examYear}</span>
                      {question.topic && <span className="text-xs text-muted-foreground">· {question.topic}</span>}
                    </div>
                    <p className="whitespace-pre-wrap font-medium">{question.question}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => editQuestion(question)}><Pencil className="mr-1 h-3.5 w-3.5" />Edit</Button>
                    {question.status === "draft" && (
                      <Button type="button" size="sm" disabled={updateQuestionStatus.isPending} onClick={() => updateQuestionStatus.mutate({ id: question.id, action: "publish" })}>
                        <Send className="mr-1 h-3.5 w-3.5" />Publish
                      </Button>
                    )}
                    {question.status !== "archived" ? (
                      <Button type="button" size="sm" variant="outline" disabled={updateQuestionStatus.isPending} onClick={() => updateQuestionStatus.mutate({ id: question.id, action: "archive" })}>
                        <Archive className="mr-1 h-3.5 w-3.5" />Archive
                      </Button>
                    ) : (
                      <Button type="button" size="sm" variant="outline" disabled={updateQuestionStatus.isPending} onClick={() => updateQuestionStatus.mutate({ id: question.id, action: "restore" })}>
                        <RotateCcw className="mr-1 h-3.5 w-3.5" />Restore as draft
                      </Button>
                    )}
                  </div>
                </div>
                <ol className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  {question.options.map((option, index) => (
                    <li key={index} className={question.correctAnswer === index + 1 ? "font-semibold text-emerald-700 dark:text-emerald-300" : "text-muted-foreground"}>
                      {String.fromCharCode(65 + index)}. {option}{question.correctAnswer === index + 1 ? " (answer)" : ""}
                    </li>
                  ))}
                </ol>
                {question.explanation && <p className="mt-3 whitespace-pre-wrap border-t pt-3 text-sm text-muted-foreground"><span className="font-medium text-foreground">Explanation:</span> {question.explanation}</p>}
                <p className="mt-3 text-xs text-muted-foreground">
                  Updated {new Date(question.updatedAt).toLocaleString("en-NG")}
                  {question.publishedAt ? ` · Published ${new Date(question.publishedAt).toLocaleDateString("en-NG")}` : ""}
                </p>
              </article>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function QuizPanel({ courses, selectedCourseId, chooseCourse, modules, quizzes, draft, setDraft, editingQuizId, onEdit, onCancelEdit, onSave, onDelete, pending }: any) {
  const [csvPreview, setCsvPreview] = useState<QuizCsvPreview | null>(null);
  const [csvFileName, setCsvFileName] = useState("");

  const updateQuestion = (index: number, update: Partial<QuizQuestionDraft>) => {
    setDraft({
      ...draft,
      questions: draft.questions.map((question: QuizQuestionDraft, questionIndex: number) =>
        questionIndex === index ? { ...question, ...update } : question,
      ),
    });
  };

  const handleCsvFile = async (file?: File) => {
    setCsvPreview(null);
    setCsvFileName(file?.name || "");
    if (!file) return;

    if (file.size > 1024 * 1024) {
      setCsvPreview({
        questions: [],
        issues: [{ row: 1, message: "CSV files must be 1 MB or smaller." }],
      });
      return;
    }

    try {
      setCsvPreview(parseQuizCsv(await file.text()));
    } catch (error) {
      setCsvPreview({
        questions: [],
        issues: [{
          row: 1,
          message: error instanceof Error ? `Could not read CSV: ${error.message}` : "Could not read this CSV file.",
        }],
      });
    }
  };

  const downloadCsvTemplate = () => {
    const template = [
      "question,option_a,option_b,option_c,option_d,correct_answer,explanation,question_image_url,explanation_image_url",
      '"What is 2 + 2?","3","4","5","6","B","Basic addition","",""',
    ].join("\r\n");
    const url = URL.createObjectURL(new Blob([template], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "learnpedia-quiz-questions-template.csv";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const appendImportedQuestions = () => {
    if (!csvPreview || csvPreview.issues.length > 0 || csvPreview.questions.length === 0) return;
    const existingQuestions = draft.questions.length === 1 && isInitialEmptyQuizQuestion(draft.questions[0])
      ? []
      : draft.questions;
    setDraft({
      ...draft,
      questions: [
        ...existingQuestions,
        ...csvPreview.questions,
      ],
    });
    setCsvPreview(null);
    setCsvFileName("");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{editingQuizId ? "Edit quiz" : "Quiz builder"}</CardTitle>
          <CardDescription>Add as many questions as your module needs. Questions can include an optional image and explanation.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <CourseSelect courses={courses} value={selectedCourseId} onChange={chooseCourse} />

          <Field label="Module">
            <select className="h-10 w-full rounded-md border bg-background px-3 text-sm text-foreground" value={draft.moduleId} onChange={(e) => setDraft({ ...draft, moduleId: e.target.value })}>
              <option value="" className="bg-background text-foreground">Choose a module</option>
              {modules.map((m: Module) => (
                <option key={m.id} value={m.id} className="bg-background text-foreground">{m.title}</option>
              ))}
            </select>
          </Field>

          <Field label="Quiz title">
            <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          </Field>

          <Field label="Passing score (%)">
            <Input type="number" min="1" max="100" value={draft.passScore} onChange={(e) => setDraft({ ...draft, passScore: e.target.value })} />
          </Field>

          <section className="space-y-3 rounded-lg border bg-muted/20 p-4" aria-label="Import questions from CSV">
            <div>
              <h3 className="font-semibold">Import questions from CSV</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Questions are added to this draft only after every row passes validation. Import never saves or replaces a quiz by itself.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Required columns: question, option_a through option_d, and correct_answer (A-D or 1-4). Explanations and image URLs are optional. Maximum file size: 1 MB.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={downloadCsvTemplate}>
                <Download className="mr-2 h-4 w-4" />Download template
              </Button>
              <Label
                htmlFor="quiz-csv-upload"
                className="inline-flex min-h-8 cursor-pointer items-center justify-center rounded-md border bg-background px-3 text-xs font-medium hover:bg-accent"
              >
                <FileUp className="mr-2 h-4 w-4" />Choose CSV
              </Label>
              <Input
                id="quiz-csv-upload"
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={(event) => void handleCsvFile(event.target.files?.[0])}
              />
            </div>
            {csvFileName && <p className="text-xs text-muted-foreground">Selected file: {csvFileName}</p>}

            {csvPreview && (
              <div className="space-y-3 rounded-md border bg-background p-3" aria-live="polite">
                {csvPreview.issues.length > 0 ? (
                  <>
                    <div>
                      <p className="font-medium text-destructive">Import blocked: fix all CSV errors before importing.</p>
                      <p className="text-sm text-muted-foreground">
                        {csvPreview.questions.length} valid question{csvPreview.questions.length === 1 ? "" : "s"} found, but no questions were added.
                      </p>
                    </div>
                    <ul className="max-h-48 space-y-1 overflow-y-auto text-sm">
                      {csvPreview.issues.map((issue, index) => (
                        <li key={`${issue.row}-${index}`} className="text-destructive">
                          Row {issue.row}: {issue.message}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <>
                    <div>
                      <p className="font-medium text-emerald-700 dark:text-emerald-300">
                        Preview ready: {csvPreview.questions.length} question{csvPreview.questions.length === 1 ? "" : "s"}
                      </p>
                      <p className="text-sm text-muted-foreground">All rows passed validation. Confirm to append them to this quiz draft.</p>
                    </div>
                    <div className="max-h-56 space-y-2 overflow-y-auto">
                      {csvPreview.questions.slice(0, 5).map((question, index) => (
                        <div key={question.id} className="rounded-md border p-2 text-sm">
                          <p className="font-medium">{index + 1}. {question.question}</p>
                          <p className="mt-1 text-muted-foreground">
                            A. {question.options[0]} · B. {question.options[1]} · C. {question.options[2]} · D. {question.options[3]}
                          </p>
                          <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
                            Correct answer: {String.fromCharCode(64 + Number(question.correctAnswer))}
                          </p>
                        </div>
                      ))}
                      {csvPreview.questions.length > 5 && (
                        <p className="text-xs text-muted-foreground">
                          Showing the first 5 of {csvPreview.questions.length} questions.
                        </p>
                      )}
                    </div>
                    <Button type="button" size="sm" onClick={appendImportedQuestions}>
                      Add {csvPreview.questions.length} question{csvPreview.questions.length === 1 ? "" : "s"} to draft
                    </Button>
                  </>
                )}
              </div>
            )}
          </section>

          <div className="space-y-4">
            {draft.questions.map((question: QuizQuestionDraft, index: number) => (
              <Card key={question.id} className="border-dashed">
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-base">Question {index + 1}</CardTitle>
                  {draft.questions.length > 1 && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setDraft({
                      ...draft,
                      questions: draft.questions.filter((_: QuizQuestionDraft, questionIndex: number) => questionIndex !== index),
                    })}>
                      <Trash2 className="mr-2 h-4 w-4" />Remove
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  <Field label="Question">
                    <QuizMarkdownEditor value={question.question} onChange={(value) => updateQuestion(index, { question: value })} placeholder="Write the question. Paste lists or LaTeX equations here." />
                  </Field>

                  <Field label="Question image URL (optional)">
                    <Input
                      type="url"
                      value={question.questionImageUrl}
                      onChange={(event) => updateQuestion(index, { questionImageUrl: event.target.value })}
                      placeholder="https://example.com/question-image.png"
                    />
                  </Field>
                  {question.questionImageUrl.trim() && (
                    <img
                      src={question.questionImageUrl}
                      alt={`Preview for question ${index + 1}`}
                      className="max-h-56 max-w-full rounded-md border object-contain"
                    />
                  )}

                  <Field label="Explanation (optional)">
                    <QuizMarkdownEditor value={question.explanation} onChange={(value) => updateQuestion(index, { explanation: value })} placeholder="Explain why the answer is correct." />
                  </Field>

                  <div className="grid gap-3 md:grid-cols-2">
                    {question.options.map((option: string, optionIndex: number) => (
                      <Field key={optionIndex} label={`Option ${optionIndex + 1}`}>
                        <Input
                          value={option}
                          onChange={(event) => {
                            const options = [...question.options];
                            options[optionIndex] = event.target.value;
                            updateQuestion(index, { options });
                          }}
                        />
                      </Field>
                    ))}
                  </div>

                  <Field label="Correct option">
                    <select className="h-10 w-full rounded-md border bg-background px-3 text-sm text-foreground" value={question.correctAnswer} onChange={(event) => updateQuestion(index, { correctAnswer: event.target.value })}>
                      {[1, 2, 3, 4].map((optionNumber) => <option key={optionNumber} value={optionNumber}>Option {optionNumber}</option>)}
                    </select>
                  </Field>
                </CardContent>
              </Card>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => setDraft({ ...draft, questions: [...draft.questions, createEmptyQuizQuestion()] })}
          >
            <Plus className="mr-2 h-4 w-4" />Add question
          </Button>

          <div className="flex flex-wrap gap-2">
            <Button
              disabled={pending || !selectedCourseId || !draft.moduleId || !draft.title.trim() || draft.questions.some((question: QuizQuestionDraft) => !question.question.trim() || question.options.some((option) => !option.trim()))}
              onClick={onSave}
            >
              {editingQuizId ? "Save quiz" : "Create quiz"}
            </Button>
            {editingQuizId && <Button variant="outline" onClick={onCancelEdit}>Cancel edit</Button>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quiz library</CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          {quizzes.length === 0 ? <p className="py-3 text-sm text-muted-foreground">No quizzes created yet.</p> : quizzes.map((quiz: QuizRecord) => (
            <div key={quiz.id} className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium">{quiz.title}</p>
                <p className="text-sm text-muted-foreground">{quiz.questions.length} questions · Pass score: {quiz.passScore}%</p>
              </div>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" onClick={() => onEdit(quiz)}>Edit</Button>
                <Button variant="ghost" size="sm" onClick={() => onDelete(quiz.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function UsersPanel({ users, canCreateInstructor, draft, setDraft, onCreate, pending, createdInstructor }: {
  users: Omit<User, "password">[];
  canCreateInstructor: boolean;
  draft: { fullName: string; email: string; password: string };
  setDraft: (draft: { fullName: string; email: string; password: string }) => void;
  onCreate: () => void;
  pending: boolean;
  createdInstructor: { fullName: string; email: string; temporaryPassword: string } | null;
}) {
  return (
    <div className="space-y-6">
      {canCreateInstructor && (
        <Card>
          <CardHeader>
            <CardTitle>Add an instructor</CardTitle>
            <CardDescription>Create an instructor account now. A temporary password is generated unless you provide one, then share the login details securely.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Full name">
                <Input value={draft.fullName} onChange={(event) => setDraft({ ...draft, fullName: event.target.value })} placeholder="Instructor name" />
              </Field>
              <Field label="Email address">
                <Input type="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} placeholder="instructor@example.com" />
              </Field>
            </div>
            <Field label="Temporary password (optional)">
              <Input type="text" value={draft.password} onChange={(event) => setDraft({ ...draft, password: event.target.value })} placeholder="Leave blank to generate one" />
            </Field>
            <Button disabled={pending || !draft.fullName || !draft.email} onClick={onCreate}>
              {pending ? "Creating account..." : "Create instructor account"}
            </Button>
          </CardContent>
        </Card>
      )}

      {createdInstructor && (
        <Card className="border-primary/40">
          <CardHeader>
            <CardTitle>Instructor login details</CardTitle>
            <CardDescription>Share these details securely. The email delivery service will be connected before production launch.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><span className="font-medium">Name:</span> {createdInstructor.fullName}</p>
            <p><span className="font-medium">Email:</span> {createdInstructor.email}</p>
            <p><span className="font-medium">Temporary password:</span> <span className="font-mono">{createdInstructor.temporaryPassword}</span></p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>User accounts</CardTitle>
          <CardDescription>Instructors can create courses themselves. Use the course editor to assign specific courses to them.</CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          {users.map((account) => (
            <div key={account.id} className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium">{account.fullName}</p>
                <p className="text-sm text-muted-foreground">{account.email}</p>
              </div>
              <Badge variant="outline" className="capitalize">{account.role}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function EnrollmentPanel({ users, courses, value, setValue, onEnroll, onRemove, onReset }: any) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Enrollment management</CardTitle>
        <CardDescription>Enroll or remove students without changing their subscription or course content access. Progress history is kept when enrollment is removed.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Student">
            <select className="h-10 rounded-md border bg-background px-3 text-sm" value={value.userId} onChange={(e) => setValue({ ...value, userId: e.target.value })}>
              <option value="">Choose a student</option>
              {users.filter((u: User) => u.role === "student").map((u: User) => (
                <option key={u.id} value={u.id}>{u.fullName}</option>
              ))}
            </select>
          </Field>

          <Field label="Course">
            <select className="h-10 rounded-md border bg-background px-3 text-sm" value={value.courseId} onChange={(e) => setValue({ ...value, courseId: e.target.value })}>
              <option value="">Choose a restricted course</option>
              {courses.filter((c: Course) => c.enrollmentMode === "restricted").map((c: Course) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          </Field>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button onClick={onEnroll}>Enroll student</Button>
          <Button variant="secondary" onClick={onRemove}>Remove enrollment</Button>
          <Button variant="outline" onClick={onReset}>Reset progress</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function LearnerProgressPanel({
  courses,
  selectedCourseId,
  onCourseChange,
  data,
  isLoading,
  isError,
}: {
  courses: Course[];
  selectedCourseId: string;
  onCourseChange: (courseId: string) => void;
  data?: CourseProgressResponse;
  isLoading: boolean;
  isError: boolean;
}) {
  const [search, setSearch] = useState("");
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const learners = (data?.learners ?? []).filter((learner) =>
    `${learner.fullName} ${learner.email}`.toLocaleLowerCase().includes(normalizedSearch)
  );

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Individual course progress</CardTitle>
          <CardDescription>
            Enrollment is separate from all-course access. Only enrolled students appear here; lesson completion and quiz results are shown independently.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <CourseSelect courses={courses} value={selectedCourseId} onChange={onCourseChange} />
          <Field label="Search enrolled learners">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Name or email"
            />
          </Field>
        </CardContent>
      </Card>

      {isLoading ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">Loading learner progress...</CardContent></Card>
      ) : isError ? (
        <Card><CardContent className="p-8 text-center text-destructive">Learner progress could not be loaded.</CardContent></Card>
      ) : !selectedCourseId ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">Choose a course to view its enrolled learners.</CardContent></Card>
      ) : learners.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          {normalizedSearch ? "No enrolled learners match your search." : "No students are enrolled in this course yet."}
        </CardContent></Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{data?.course.title || "Enrolled learners"}</CardTitle>
            <CardDescription>{learners.length} enrolled {learners.length === 1 ? "learner" : "learners"}</CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="divide-y">
              {learners.map((learner) => (
                <AccordionItem key={learner.id} value={learner.id} className="border-0">
                  <AccordionTrigger className="gap-4 py-4 hover:no-underline">
                    <span className="min-w-0 flex-1 text-left">
                      <span className="block truncate font-semibold">{learner.fullName}</span>
                      <span className="mt-1 block truncate text-sm font-normal text-muted-foreground">{learner.email}</span>
                      <span className="mt-2 flex items-center gap-2">
                        <Progress value={learner.progress} className="h-2 flex-1" />
                        <span className="shrink-0 text-xs text-muted-foreground">{learner.progress}%</span>
                      </span>
                    </span>
                    <Badge variant="outline" className="hidden shrink-0 sm:inline-flex">
                      {learner.completedModules}/{learner.totalModules} modules
                    </Badge>
                  </AccordionTrigger>
                  <AccordionContent className="pb-5">
                    <div className="mb-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                      <p>Enrolled {new Date(learner.enrolledAt).toLocaleDateString()}</p>
                      <p>
                        Last learning activity: {learner.lastActivityAt
                          ? new Date(learner.lastActivityAt).toLocaleString()
                          : "No activity recorded"}
                      </p>
                    </div>
                    <div className="space-y-2">
                      {learner.modules.map((module) => (
                        <div key={module.id} className="rounded-lg border p-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="text-xs text-muted-foreground">{getModuleDisplayLabel(module, learner.modules)}</p>
                              <p className="font-medium">{module.title}</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Badge variant={module.isCompleted ? "secondary" : "outline"}>
                                {module.isCompleted ? "Completed" : "Not completed"}
                              </Badge>
                              {module.hasQuiz && (
                                <Badge variant={module.isQuizPassed ? "secondary" : "outline"}>
                                  {module.isQuizPassed
                                    ? `Quiz passed${module.latestQuizScore !== null && module.latestQuizTotal ? ` · ${module.latestQuizScore}/${module.latestQuizTotal}` : ""}`
                                    : module.latestQuizScore !== null && module.latestQuizTotal
                                      ? `Latest quiz ${module.latestQuizScore}/${module.latestQuizTotal}`
                                      : "Quiz not passed"}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PartnershipInterestPanel({
  submissions,
  isLoading,
  isError,
  onRefresh,
  organizationSubmissions,
  organizationsLoading,
  organizationsError,
  onRefreshOrganizations,
}: {
  submissions: PartnershipInterest[];
  isLoading: boolean;
  isError: boolean;
  onRefresh: () => void;
  organizationSubmissions: OrganizationPartnershipInterest[];
  organizationsLoading: boolean;
  organizationsError: boolean;
  onRefreshOrganizations: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"schools" | "organizations">("schools");

  return (
    <div className="space-y-5">
      <div role="tablist" aria-label="Partner application types" className="flex flex-wrap gap-2">
        <Button
          type="button"
          role="tab"
          aria-selected={activeTab === "schools"}
          variant={activeTab === "schools" ? "default" : "outline"}
          onClick={() => setActiveTab("schools")}
        >
          School applications ({submissions.length})
        </Button>
        <Button
          type="button"
          role="tab"
          aria-selected={activeTab === "organizations"}
          variant={activeTab === "organizations" ? "default" : "outline"}
          onClick={() => setActiveTab("organizations")}
        >
          Other organisations ({organizationSubmissions.length})
        </Button>
      </div>
      {activeTab === "schools" ? (
        <SchoolPartnershipInterestList
          submissions={submissions}
          isLoading={isLoading}
          isError={isError}
          onRefresh={onRefresh}
        />
      ) : (
        <OrganizationPartnershipInterestList
          submissions={organizationSubmissions}
          isLoading={organizationsLoading}
          isError={organizationsError}
          onRefresh={onRefreshOrganizations}
        />
      )}
    </div>
  );
}

function SchoolPartnershipInterestList({
  submissions,
  isLoading,
  isError,
  onRefresh,
}: {
  submissions: PartnershipInterest[];
  isLoading: boolean;
  isError: boolean;
  onRefresh: () => void;
}) {
  if (isLoading) {
    return <Card><CardContent className="p-8 text-center text-muted-foreground">Loading school applications...</CardContent></Card>;
  }
  if (isError) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-destructive">Could not load school applications.</p>
          <Button variant="outline" className="mt-4" onClick={onRefresh}>Try again</Button>
        </CardContent>
      </Card>
    );
  }
  if (submissions.length === 0) {
    return <Card><CardContent className="p-8 text-center text-muted-foreground">No school applications have been received yet.</CardContent></Card>;
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">{submissions.length} school {submissions.length === 1 ? "submission" : "submissions"}</p>
      <Accordion type="single" collapsible className="space-y-3">
        {submissions.map((submission) => (
          <AccordionItem key={submission.id} value={submission.id} className="rounded-lg border bg-card px-4">
            <AccordionTrigger className="gap-4 py-4 text-left hover:no-underline">
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{submission.schoolName}</span>
                  <Badge variant="outline">{submission.schoolType}</Badge>
                </span>
                <span className="mt-1 block truncate text-sm font-normal text-muted-foreground">
                  {submission.cityOrLga}, {submission.state} · {submission.contactName} · {submission.emailAddress}
                </span>
                <span className="mt-1 block text-xs font-normal text-muted-foreground">
                  Submitted {new Date(submission.submittedAt).toLocaleString()}
                </span>
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-5 pb-5">
              <p className="text-sm text-muted-foreground">{submission.schoolAddress}</p>
              <div>
                <h3 className="mb-3 text-sm font-semibold">Administrative contact</h3>
                <dl className="grid gap-3 sm:grid-cols-2">
                  <PartnershipAnswer label="Contact person" value={`${submission.contactName} · ${submission.contactPosition}`} />
                  <PartnershipAnswer label="Phone" value={submission.phoneNumber} />
                  <PartnershipAnswer label="Email" value={submission.emailAddress} />
                  <PartnershipAnswer label="Preferred contact method" value={submission.preferredCommunication} />
                  <PartnershipAnswer label="Website / social page" value={submission.websiteOrSocialPage} />
                </dl>
              </div>
              <div>
                <h3 className="mb-3 text-sm font-semibold">School profile</h3>
                <dl className="grid gap-3 sm:grid-cols-2">
                  <PartnershipAnswer label="Approximate student count" value={submission.studentCount} />
                  <PartnershipAnswer label="Classes / levels" value={submission.classesAvailable} />
                  <PartnershipAnswer label="Uses digital learning" value={submission.usesDigitalLearning} />
                  <PartnershipAnswer label="Digital learning details" value={submission.digitalLearningDetails} />
                </dl>
              </div>
              <div>
                <h3 className="mb-3 text-sm font-semibold">Partnership interests</h3>
                <dl className="grid gap-3">
                  <PartnershipAnswer label="Areas of interest" value={submission.areasOfInterest.join(", ")} />
                  {submission.otherInterest && <PartnershipAnswer label="Other area" value={submission.otherInterest} />}
                  <PartnershipAnswer label="Challenges / learning needs" value={submission.challengesAndNeeds} />
                  <PartnershipAnswer label="Preferred arrangement" value={submission.partnershipArrangement} />
                  <PartnershipAnswer label="What would make a partnership valuable" value={submission.partnershipValue} />
                </dl>
              </div>
              <div>
                <h3 className="mb-3 text-sm font-semibold">Next steps</h3>
                <dl className="grid gap-3 sm:grid-cols-2">
                  <PartnershipAnswer label="Orientation / demonstration" value={submission.orientationInterest} />
                  <PartnershipAnswer label="Preferred follow-up period" value={submission.followUpPeriod} />
                  <PartnershipAnswer label="Additional comments" value={submission.additionalComments} />
                  <PartnershipAnswer label="Acknowledgement" value={submission.acknowledged ? "Confirmed" : "Not confirmed"} />
                </dl>
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}

function OrganizationPartnershipInterestList({
  submissions,
  isLoading,
  isError,
  onRefresh,
}: {
  submissions: OrganizationPartnershipInterest[];
  isLoading: boolean;
  isError: boolean;
  onRefresh: () => void;
}) {
  if (isLoading) {
    return <Card><CardContent className="p-8 text-center text-muted-foreground">Loading other organisation applications...</CardContent></Card>;
  }
  if (isError) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-destructive">Could not load other organisation applications.</p>
          <Button variant="outline" className="mt-4" onClick={onRefresh}>Try again</Button>
        </CardContent>
      </Card>
    );
  }
  if (submissions.length === 0) {
    return <Card><CardContent className="p-8 text-center text-muted-foreground">No other organisation applications have been received yet.</CardContent></Card>;
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">{submissions.length} organisation {submissions.length === 1 ? "application" : "applications"}</p>
      <Accordion type="single" collapsible className="space-y-3">
        {submissions.map((submission) => (
          <AccordionItem key={submission.id} value={submission.id} className="rounded-lg border bg-card px-4">
            <AccordionTrigger className="gap-4 py-4 text-left hover:no-underline">
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{submission.organizationName}</span>
                  <Badge variant="outline">{submission.organizationType}</Badge>
                </span>
                <span className="mt-1 block truncate text-sm font-normal text-muted-foreground">
                  {submission.location} · {submission.contactName} · {submission.emailAddress}
                </span>
                <span className="mt-1 block text-xs font-normal text-muted-foreground">
                  Submitted {new Date(submission.submittedAt).toLocaleString()}
                </span>
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-5 pb-5">
              <div>
                <h3 className="mb-3 text-sm font-semibold">Contact person</h3>
                <dl className="grid gap-3 sm:grid-cols-2">
                  <PartnershipAnswer label="Name and role" value={`${submission.contactName} · ${submission.contactRole}`} />
                  <PartnershipAnswer label="Phone" value={submission.phoneNumber} />
                  <PartnershipAnswer label="Email" value={submission.emailAddress} />
                  <PartnershipAnswer label="Website / social page" value={submission.websiteOrSocialPage} />
                  <PartnershipAnswer label="Location" value={submission.location} />
                </dl>
              </div>
              <div>
                <h3 className="mb-3 text-sm font-semibold">Partnership interests</h3>
                <dl className="grid gap-3">
                  <PartnershipAnswer label="Areas of interest" value={submission.areasOfInterest.join(", ")} />
                  {submission.otherInterest && <PartnershipAnswer label="Other area" value={submission.otherInterest} />}
                  <PartnershipAnswer label="Proposed collaboration" value={submission.partnershipProposal} />
                  <PartnershipAnswer label="Preferred arrangement" value={submission.partnershipArrangement} />
                  <PartnershipAnswer label="Additional comments" value={submission.additionalComments} />
                  <PartnershipAnswer label="Acknowledgement" value={submission.acknowledged ? "Confirmed" : "Not confirmed"} />
                </dl>
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}

function PartnershipAnswer({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap break-words text-sm">{value || "Not provided"}</dd>
    </div>
  );
}

function AnalyticsPanel({ data }: { data?: Analytics }) {
  if (!data) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">Loading analytics...</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[ ["Users", data.totalUsers], ["Courses", data.totalCourses], ["Enrollments", data.totalEnrollments], ["Passed quizzes", data.passedQuizzes] ].map(([label, value]) => (
          <Card key={String(label)}>
            <CardHeader>
              <CardDescription>{String(label)}</CardDescription>
              <CardTitle>{String(value)}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Course completion</CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          {data.courseStats.map((course) => (
            <div key={course.id} className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium">{course.title}</p>
                <p className="text-sm text-muted-foreground">{course.enrollments} enrollments</p>
              </div>
              <Badge>{course.completionRate}%</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function AnnouncementPanel({
  announcementDraft,
  setAnnouncementDraft,
  announcements,
  onCreate,
}: {
  announcementDraft: { title: string; message: string };
  setAnnouncementDraft: (draft: { title: string; message: string }) => void;
  announcements: AnnouncementRecord[];
  onCreate: () => void;
}) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Create announcement</CardTitle>
          <CardDescription>Post a message that appears on every student dashboard.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Title">
            <Input
              value={announcementDraft.title}
              onChange={(event) => setAnnouncementDraft({ ...announcementDraft, title: event.target.value })}
              placeholder="New course update"
            />
          </Field>

          <Field label="Message">
            <textarea
              className="min-h-32 w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={announcementDraft.message}
              onChange={(event) => setAnnouncementDraft({ ...announcementDraft, message: event.target.value })}
              placeholder="Write the announcement details here..."
            />
          </Field>

          <Button onClick={onCreate} disabled={!announcementDraft.title.trim() || !announcementDraft.message.trim()}>
            Post announcement
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Published announcements</CardTitle>
          <CardDescription>Newest announcements appear first.</CardDescription>
        </CardHeader>
        <CardContent>
          {announcements.length === 0 ? (
            <p className="text-sm text-muted-foreground">No announcements yet.</p>
          ) : (
            <Accordion type="single" collapsible className="space-y-3">
              {announcements.map((announcement) => (
                <AccordionItem key={announcement.id} value={announcement.id} className="rounded-md border bg-background px-3">
                  <AccordionTrigger className="text-left">
                    <div className="flex w-full flex-col gap-1 text-left">
                      <span className="font-medium">{announcement.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {announcement.authorName} • {new Date(announcement.createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-2 text-sm leading-6 text-muted-foreground">
                    <p className="whitespace-pre-wrap">{announcement.message}</p>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface EventDraft {
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  location: string;
  meetingUrl: string;
}

function createEmptyEventDraft(): EventDraft {
  const now = new Date();
  const startsAt = new Date(now.getTime() + 60 * 60 * 1000);
  startsAt.setMinutes(0, 0, 0);
  const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Lagos";
  return {
    title: "",
    description: "",
    startsAt: formatDateTimeForZone(startsAt, timezone),
    endsAt: formatDateTimeForZone(endsAt, timezone),
    timezone,
    location: "",
    meetingUrl: "",
  };
}

function EventManagementPanel({ userId, canManageAll }: { userId: string; canManageAll: boolean }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<EventDraft>(createEmptyEventDraft);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const eventsQuery = useQuery<EventRecord[]>({
    queryKey: ["/api/admin/events", userId],
    queryFn: () => apiRequest("GET", "/api/admin/events"),
  });
  const events = eventsQuery.data ?? [];
  const resetDraft = () => {
    setDraft(createEmptyEventDraft());
    setEditingEventId(null);
  };
  const saveEvent = useMutation({
    mutationFn: () => {
      const payload = {
        ...draft,
        startsAt: localDateTimeToUtc(draft.startsAt, draft.timezone).toISOString(),
        endsAt: localDateTimeToUtc(draft.endsAt, draft.timezone).toISOString(),
      };
      return apiRequest(
        editingEventId ? "PATCH" : "POST",
        editingEventId ? `/api/admin/events/${editingEventId}` : "/api/admin/events",
        payload,
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["/api/admin/events", userId] });
      void queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      toast({ title: editingEventId ? "Event updated" : "Event saved as draft" });
      resetDraft();
    },
    onError: (error: Error) => toast({ title: "Could not save event", description: error.message, variant: "destructive" }),
  });
  const updateEventStatus = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "publish" | "cancel" | "delete" }) =>
      action === "delete"
        ? apiRequest("DELETE", `/api/admin/events/${id}`)
        : apiRequest("POST", `/api/admin/events/${id}/${action}`),
    onSuccess: (_result, { action }) => {
      void queryClient.invalidateQueries({ queryKey: ["/api/admin/events", userId] });
      void queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      void queryClient.invalidateQueries({ queryKey: ["/api/events/notifications"] });
      toast({ title: { publish: "Event published", cancel: "Event cancelled", delete: "Draft deleted" }[action] });
    },
    onError: (error: Error) => toast({ title: "Could not update event", description: error.message, variant: "destructive" }),
  });

  const editEvent = (event: EventRecord) => {
    setEditingEventId(event.id);
    setDraft({
      title: event.title,
      description: event.description,
      startsAt: formatDateTimeForZone(new Date(event.startsAt), event.timezone),
      endsAt: formatDateTimeForZone(new Date(event.endsAt), event.timezone),
      timezone: event.timezone,
      location: event.location || "",
      meetingUrl: event.meetingUrl || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{editingEventId ? "Edit event" : "Create an event"}</CardTitle>
          <CardDescription>
            Events are visible to all students. Saving creates a draft; publishing sends an in-app notification to students.
            Updating a published event sends another notification.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              saveEvent.mutate();
            }}
          >
            <Field label="Event title">
              <Input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} maxLength={160} required />
            </Field>
            <Field label="Description">
              <Textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} rows={4} maxLength={10000} required />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Start date and time">
                <Input type="datetime-local" value={draft.startsAt} onChange={(event) => setDraft({ ...draft, startsAt: event.target.value })} required />
              </Field>
              <Field label="End date and time">
                <Input type="datetime-local" value={draft.endsAt} onChange={(event) => setDraft({ ...draft, endsAt: event.target.value })} required />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Timezone (IANA)">
                <Input value={draft.timezone} onChange={(event) => setDraft({ ...draft, timezone: event.target.value })} placeholder="Africa/Lagos" maxLength={100} required />
              </Field>
              <Field label="Location (optional)">
                <Input value={draft.location} onChange={(event) => setDraft({ ...draft, location: event.target.value })} maxLength={200} placeholder="Venue or online" />
              </Field>
            </div>
            <Field label="Meeting link (optional, HTTPS)">
              <Input type="url" value={draft.meetingUrl} onChange={(event) => setDraft({ ...draft, meetingUrl: event.target.value })} maxLength={500} placeholder="https://..." />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={saveEvent.isPending}>
                {saveEvent.isPending ? "Saving..." : editingEventId ? "Save changes" : "Save as draft"}
              </Button>
              {editingEventId && <Button type="button" variant="outline" onClick={resetDraft}>Cancel edit</Button>}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Events</CardTitle>
          <CardDescription>{canManageAll ? "Manage all events created by staff." : "Manage events you created."}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {eventsQuery.isPending && <p className="text-sm text-muted-foreground">Loading events...</p>}
          {eventsQuery.isError && <p role="alert" className="text-sm text-destructive">Events could not be loaded. Refresh to try again.</p>}
          {!eventsQuery.isPending && !eventsQuery.isError && events.length === 0 && (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No events have been created yet.</p>
          )}
          {events.map((event) => (
            <article key={event.id} className="space-y-3 rounded-xl border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{event.title}</h3>
                    <Badge variant={event.status === "published" ? "default" : event.status === "cancelled" ? "destructive" : "secondary"}>{event.status}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {new Date(event.startsAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short", timeZone: event.timezone })}
                    {" – "}
                    {new Date(event.endsAt).toLocaleString([], { dateStyle: "short", timeStyle: "short", timeZone: event.timezone })}
                    {" · "}{event.timezone}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">Created by {event.authorName} · {event.rsvpCount} attending</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {event.status !== "cancelled" && <Button type="button" size="sm" variant="outline" onClick={() => editEvent(event)}>Edit</Button>}
                  {event.status === "draft" && (
                    <>
                      <Button type="button" size="sm" disabled={updateEventStatus.isPending} onClick={() => updateEventStatus.mutate({ id: event.id, action: "publish" })}>
                        <Send className="mr-1 h-3.5 w-3.5" />Publish
                      </Button>
                      <Button type="button" size="sm" variant="ghost" disabled={updateEventStatus.isPending} onClick={() => updateEventStatus.mutate({ id: event.id, action: "delete" })}>
                        <Trash2 className="mr-1 h-3.5 w-3.5" />Delete
                      </Button>
                    </>
                  )}
                  {event.status === "published" && (
                    <Button type="button" size="sm" variant="destructive" disabled={updateEventStatus.isPending} onClick={() => {
                      if (window.confirm(`Cancel "${event.title}"? Students will receive a cancellation notification.`)) {
                        updateEventStatus.mutate({ id: event.id, action: "cancel" });
                      }
                    }}>Cancel event</Button>
                  )}
                </div>
              </div>
              <p className="whitespace-pre-wrap text-sm">{event.description}</p>
              {(event.location || event.meetingUrl) && (
                <p className="text-sm text-muted-foreground">
                  {event.location}{event.location && event.meetingUrl ? " · " : ""}
                  {event.meetingUrl && <a className="text-primary underline" href={event.meetingUrl} target="_blank" rel="noreferrer">Meeting link</a>}
                </p>
              )}
            </article>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function PlannedFeaturePanel({
  title,
  description,
  details,
}: {
  title: string;
  description: string;
  details: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{details}</p>
        <p className="mt-4 text-sm font-medium">Creation and management tools are planned and are not available yet.</p>
      </CardContent>
    </Card>
  );
}
