import { useEffect, useMemo, useState } from "react";
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
import type { AnnouncementRecord } from "@/lib/announcements";
import type { Course, Module, User } from "@shared/schema";
import { BarChart3, BookOpen, FileQuestion, LayoutDashboard, Plus, Settings2, Trash2, UserRound, Users } from "lucide-react";

type Section = "overview" | "courses" | "modules" | "quizzes" | "users" | "enrollments" | "analytics" | "announcements";

interface QuizRecord {
  id: string;
  moduleId: string;
  title: string;
  passScore: number;
  questions: Array<{ id: string; question: string; options: string[]; correctAnswer: number }>;
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

export default function AdminCms() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [section, setSection] = useState<Section>("overview");
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [courseDraft, setCourseDraft] = useState({ title: "", description: "", enrollmentMode: "self", instructorId: "", thumbnail: "", isPublished: false });
  const [newCourseDraft, setNewCourseDraft] = useState({ title: "", description: "", enrollmentMode: "self", instructorId: "", thumbnail: "", isPublished: false });
  const [moduleDraft, setModuleDraft] = useState({ title: "", order: "1", content: "", duration: "30", parentModuleId: "", prerequisiteModuleId: "", videoUrl: "", imageUrl: "" });
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);
  const [quizDraft, setQuizDraft] = useState({ moduleId: "", title: "", passScore: "70", question: "", options: ["", ""], correctAnswer: "0" });
  const [enrollment, setEnrollment] = useState({ userId: "", courseId: "" });
  const [instructorDraft, setInstructorDraft] = useState({ fullName: "", email: "", password: "" });
  const [createdInstructor, setCreatedInstructor] = useState<{ fullName: string; email: string; temporaryPassword: string } | null>(null);
  const [announcementDraft, setAnnouncementDraft] = useState({ title: "", message: "" });

  const canManage = !!user && isStaffRole(user.role);
  const adminId = user?.id || "";

  useEffect(() => {
    if (!isAuthenticated) setLocation("/login");
  }, [isAuthenticated, setLocation]);

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
      setQuizDraft({ moduleId: "", title: "", passScore: "70", question: "", options: ["", ""], correctAnswer: "0" });
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
    mutationFn: () => apiRequest("POST", "/api/admin/quizzes", {
      userId: adminId,
      quiz: {
        moduleId: quizDraft.moduleId,
        title: quizDraft.title,
        passScore: Number(quizDraft.passScore),
        questions: [{
          id: crypto.randomUUID(),
          question: quizDraft.question,
          options: quizDraft.options,
          correctAnswer: Number(quizDraft.correctAnswer),
        }],
      },
    }),
    onSuccess: () => {
      invalidate(["/api/admin/quizzes", adminId]);
      setQuizDraft({ moduleId: "", title: "", passScore: "70", question: "", options: ["", ""], correctAnswer: "0" });
      toast({ title: "Quiz created" });
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
                <Card>
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
              modules={modules.data || []}
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
  const topLevelModules = modules.filter((module: Module) => !module.parentModuleId);
  const childModules = (parentId: string) => modules.filter((module: Module) => module.parentModuleId === parentId);

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
            <textarea className="min-h-36 w-full rounded-md border bg-background px-3 py-2 text-sm" value={draft.content} onChange={(e) => setDraft({ ...draft, content: e.target.value })} />
          </Field>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Duration (minutes)">
              <Input type="number" min="1" value={draft.duration} onChange={(e) => setDraft({ ...draft, duration: e.target.value })} />
            </Field>

            <Field label="Prerequisite">
              <select className="h-10 rounded-md border bg-background px-3 text-sm" value={draft.prerequisiteModuleId} onChange={(e) => setDraft({ ...draft, prerequisiteModuleId: e.target.value })}>
                <option value="">None</option>
                {modules.map((m: Module) => (
                  <option key={m.id} value={m.id}>{m.order}. {m.title}</option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Parent module">
              <select className="h-10 rounded-md border bg-background px-3 text-sm" value={draft.parentModuleId} onChange={(e) => setDraft({ ...draft, parentModuleId: e.target.value })}>
                <option value="">Top-level module</option>
                {modules.filter((m: Module) => !m.parentModuleId).map((m: Module) => (
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

function QuizPanel({ courses, selectedCourseId, chooseCourse, modules, quizzes, draft, setDraft, onSave, onDelete, pending }: any) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Quiz builder</CardTitle>
          <CardDescription>Create a quiz with a question and passing score.</CardDescription>
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

          <Field label="Question">
            <Input value={draft.question} onChange={(e) => setDraft({ ...draft, question: e.target.value })} />
          </Field>

          <div className="grid gap-3 md:grid-cols-2">
            {draft.options.map((option: string, index: number) => (
              <Field key={index} label={`Option ${index + 1}`}>
                <Input
                  value={option}
                  onChange={(e) => {
                    const options = [...draft.options];
                    options[index] = e.target.value;
                    setDraft({ ...draft, options });
                  }}
                />
              </Field>
            ))}
          </div>

          <Field label="Correct option index">
            <Input type="number" min="0" max="1" value={draft.correctAnswer} onChange={(e) => setDraft({ ...draft, correctAnswer: e.target.value })} />
          </Field>

          <Button disabled={pending || !selectedCourseId || !draft.moduleId || !draft.title.trim() || !draft.question.trim()} onClick={onSave}>
            <Plus className="mr-2 h-4 w-4" />Create quiz
          </Button>
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
                <p className="text-sm text-muted-foreground">Pass score: {quiz.passScore}%</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => onDelete(quiz.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
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
