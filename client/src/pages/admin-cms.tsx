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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useAuth } from "@/lib/auth-context";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { QuizMarkdownEditor } from "@/components/quiz/quiz-markdown";
import type { AnnouncementRecord } from "@/lib/announcements";
import type { Course, Module, QuizQuestion, User } from "@shared/schema";
import { BarChart3, BookOpen, FileQuestion, LayoutDashboard, Plus, Settings2, Trash2, UserRound, Users } from "lucide-react";

type Section = "overview" | "courses" | "modules" | "quizzes" | "users" | "enrollments" | "analytics" | "announcements";

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
  moduleDraft: { title: string; order: string; content: string; duration: string; parentModuleId: string; prerequisiteModuleId: string; videoUrl: string; imageUrl: string };
  editingModuleId: string | null;
  quizDraft: QuizDraft;
  editingQuizId: string | null;
}

interface Analytics {
  totalUsers: number;
  totalCourses: number;
  totalEnrollments: number;
  quizAttempts: number;
  passedQuizzes: number;
  courseStats: Array<{ id: string; title: string; enrollments: number; completionRate: number }>;
}

const navItems: Array<{ id: Section; label: string; icon: typeof LayoutDashboard }> = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "courses", label: "Courses", icon: BookOpen },
  { id: "modules", label: "Modules", icon: Settings2 },
  { id: "quizzes", label: "Quizzes", icon: FileQuestion },
  { id: "users", label: "Users", icon: UserRound },
  { id: "enrollments", label: "Enrollments", icon: Users },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "announcements", label: "Announcements", icon: Plus },
];

const isStaffRole = (role?: string | null) => ["admin", "super_admin", "instructor"].includes(role || "");
const isSuperAdmin = (role?: string | null) => ["admin", "super_admin"].includes(role || "");
const sections = new Set<Section>(["overview", "courses", "modules", "quizzes", "users", "enrollments", "analytics", "announcements"]);

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
  const [moduleDraft, setModuleDraft] = useState({ title: "", order: "1", content: "", duration: "30", parentModuleId: "", prerequisiteModuleId: "", videoUrl: "", imageUrl: "" });
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);
  const [quizDraft, setQuizDraft] = useState<QuizDraft>({ moduleId: "", title: "", passScore: "70", questions: [createEmptyQuizQuestion()] });
  const [editingQuizId, setEditingQuizId] = useState<string | null>(null);
  const [restoredDraftUserId, setRestoredDraftUserId] = useState("");
  const [enrollment, setEnrollment] = useState({ userId: "", courseId: "" });
  const [instructorDraft, setInstructorDraft] = useState({ fullName: "", email: "", password: "" });
  const [createdInstructor, setCreatedInstructor] = useState<{ fullName: string; email: string; temporaryPassword: string } | null>(null);
  const [announcementDraft, setAnnouncementDraft] = useState({ title: "", message: "" });
  const courseEditorRef = useRef<HTMLDivElement>(null);

  const canManage = !!user && isStaffRole(user.role);

  useEffect(() => {
    if (!isAuthenticated) setLocation("/login");
  }, [isAuthenticated, setLocation]);

  useEffect(() => {
    const draft = readCmsDraft(adminId);
    if (draft) {
      if (draft.section) setSection(draft.section);
      if (typeof draft.selectedCourseId === "string") setSelectedCourseId(draft.selectedCourseId);
      if (draft.courseDraft) setCourseDraft((current) => ({ ...current, ...draft.courseDraft }));
      if (draft.newCourseDraft) setNewCourseDraft((current) => ({ ...current, ...draft.newCourseDraft }));
      if (draft.moduleDraft) setModuleDraft((current) => ({ ...current, ...draft.moduleDraft }));
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

  const invalidate = (key: string[]) => queryClient.invalidateQueries({ queryKey: key });

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
      setModuleDraft({ title: "", order: "1", content: "", duration: "30", parentModuleId: "", prerequisiteModuleId: "", videoUrl: "", imageUrl: "" });
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
        videoUrl: moduleDraft.videoUrl || null,
        imageUrl: moduleDraft.imageUrl || null,
      },
    }),
    onSuccess: () => {
      invalidate(["/api/modules/course", selectedCourseId]);
      setEditingModuleId(null);
      setModuleDraft({ title: "", order: "1", content: "", duration: "30", parentModuleId: "", prerequisiteModuleId: "", videoUrl: "", imageUrl: "" });
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
    onSuccess: () => toast({ title: "Enrollment removed" }),
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
    setModuleDraft({ title: "", order: "1", content: "", duration: "30", parentModuleId: "", prerequisiteModuleId: "", videoUrl: "", imageUrl: "" });
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

  return (
    <div className="min-h-screen bg-muted/20">
      <Navbar />
      <main className="mx-auto flex max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <aside className="hidden w-52 shrink-0 md:block">
          <div className="sticky top-24 space-y-1">
            <p className="mb-4 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">CMS workspace</p>
            {navItems.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setSection(id)}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-medium ${section === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
              >
                <Icon className="h-4 w-4" />
                {label}
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
              {navItems.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
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

          {section === "analytics" && <AnalyticsPanel data={analytics.data} />}

          {section === "announcements" && (
            <AnnouncementPanel
              announcementDraft={announcementDraft}
              setAnnouncementDraft={setAnnouncementDraft}
              announcements={announcementFeed.data || []}
              onCreate={() => createAnnouncement.mutate()}
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
            <QuizMarkdownEditor value={draft.content} onChange={(content) => setDraft({ ...draft, content })} placeholder="Write the lesson. Paste lists or LaTeX equations here. Use Markdown image syntax to place an image within the text." minHeight="min-h-56" />
          </Field>

          <Field label="Module image URL (optional)">
            <Input
              type="url"
              value={draft.imageUrl}
              onChange={(event) => setDraft({ ...draft, imageUrl: event.target.value })}
              placeholder="https://example.com/lesson-image.png"
            />
          </Field>
          <p className="-mt-3 text-sm text-muted-foreground">
            This image appears with the lesson. To position images inside the explanation, use Markdown syntax: ![Description](image URL).
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
            <Field label="Video URL">
              <Input value={draft.videoUrl} onChange={(e) => setDraft({ ...draft, videoUrl: e.target.value })} placeholder="https://..." />
            </Field>
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
                  setDraft({ title: "", order: "1", content: "", duration: "30", parentModuleId: "", prerequisiteModuleId: "", videoUrl: "", imageUrl: "" });
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
                      <p className="text-xs text-muted-foreground">{module.duration} minutes{module.videoUrl ? " · video attached" : ""}</p>
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
                        videoUrl: module.videoUrl || "",
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
                              videoUrl: child.videoUrl || "",
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

function QuizPanel({ courses, selectedCourseId, chooseCourse, modules, quizzes, draft, setDraft, editingQuizId, onEdit, onCancelEdit, onSave, onDelete, pending }: any) {
  const updateQuestion = (index: number, update: Partial<QuizQuestionDraft>) => {
    setDraft({
      ...draft,
      questions: draft.questions.map((question: QuizQuestionDraft, questionIndex: number) =>
        questionIndex === index ? { ...question, ...update } : question,
      ),
    });
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
        <CardDescription>Assign or remove students from restricted courses and reset their progress.</CardDescription>
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
