import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Navbar } from "@/components/navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Course, Module, User } from "@shared/schema";
import { BookOpen, Trash2, Users } from "lucide-react";

interface CourseForm { title: string; description: string; enrollmentMode: string; thumbnail: string }
interface ModuleForm { courseId: string; title: string; order: string; content: string; duration: string; prerequisiteModuleId: string }

export default function Admin() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<CourseForm>({ title: "", description: "", enrollmentMode: "self", thumbnail: "" });
  const [enrollment, setEnrollment] = useState({ userId: "", courseId: "" });
  const [moduleForm, setModuleForm] = useState<ModuleForm>({ courseId: "", title: "", order: "1", content: "", duration: "30", prerequisiteModuleId: "" });
  const canManage = user && ["admin", "super_admin", "instructor"].includes(user.role);

  useEffect(() => { if (!isAuthenticated) setLocation("/login"); }, [isAuthenticated, setLocation]);

  const coursesQuery = useQuery<Course[]>({ queryKey: ["/api/admin/courses", user?.id], queryFn: async () => apiRequest("GET", `/api/admin/courses?userId=${user?.id}`), enabled: !!canManage });
  const usersQuery = useQuery<Omit<User, "password">[]>({ queryKey: ["/api/admin/users", user?.id], queryFn: async () => apiRequest("GET", `/api/admin/users?userId=${user?.id}`), enabled: !!canManage });
  const createMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/courses", { userId: user?.id, course: { ...form, thumbnail: form.thumbnail || null } }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/courses", user?.id] }); setForm({ title: "", description: "", enrollmentMode: "self", thumbnail: "" }); toast({ title: "Course created", description: "The course is ready for enrollment." }); },
    onError: (error: Error) => toast({ title: "Could not create course", description: error.message, variant: "destructive" }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/courses/${id}?userId=${user?.id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/courses", user?.id] }),
  });
  const enrollMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/enrollments", { instructorId: user?.id, ...enrollment }),
    onSuccess: () => { setEnrollment({ userId: "", courseId: "" }); toast({ title: "Student enrolled", description: "The student can now access the course." }); },
    onError: (error: Error) => toast({ title: "Enrollment failed", description: error.message, variant: "destructive" }),
  });
  const modulesQuery = useQuery<Module[]>({ queryKey: ["/api/modules/course", moduleForm.courseId], enabled: !!moduleForm.courseId });
  const createModuleMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/modules", { userId: user?.id, module: { ...moduleForm, order: Number(moduleForm.order), duration: Number(moduleForm.duration), prerequisiteModuleId: moduleForm.prerequisiteModuleId || null } }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/modules/course", moduleForm.courseId] }); setModuleForm((current) => ({ ...current, title: "", content: "", order: String(Number(current.order) + 1), prerequisiteModuleId: "" })); toast({ title: "Module created" }); },
    onError: (error: Error) => toast({ title: "Could not create module", description: error.message, variant: "destructive" }),
  });
  const deleteModuleMutation = useMutation({ mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/modules/${id}?userId=${user?.id}`), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/modules/course", moduleForm.courseId] }) });

  if (!user) return null;
  if (!canManage) return <><Navbar /><main className="mx-auto max-w-2xl px-4 py-16 text-center"><h1 className="text-2xl font-bold">Admin access required</h1><p className="mt-2 text-muted-foreground">Your account does not have permission to manage courses.</p></main></>;

  const updateField = (field: keyof CourseForm, value: string) => setForm((current) => ({ ...current, [field]: value }));

  return (
    <div className="min-h-screen bg-background"><Navbar /><main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8"><p className="text-sm font-medium text-primary">Workspace management</p><h1 className="mt-1 text-3xl font-bold">Admin CMS</h1><p className="mt-2 text-muted-foreground">Create courses and control how students enter them.</p></div>
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card><CardHeader><CardTitle>Create course</CardTitle><CardDescription>Self-enrolled courses are open to students. Restricted courses require staff enrollment.</CardDescription></CardHeader><CardContent><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); createMutation.mutate(); }}>
          <div className="space-y-2"><Label htmlFor="course-title">Title</Label><Input id="course-title" value={form.title} onChange={(event) => updateField("title", event.target.value)} required /></div>
          <div className="space-y-2"><Label htmlFor="course-description">Description</Label><Input id="course-description" value={form.description} onChange={(event) => updateField("description", event.target.value)} required /></div>
          <div className="space-y-2"><Label htmlFor="course-mode">Enrollment mode</Label><select id="course-mode" className="flex h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.enrollmentMode} onChange={(event) => updateField("enrollmentMode", event.target.value)}><option value="self">Self-enrollment</option><option value="restricted">Instructor enrollment</option></select></div>
          <div className="space-y-2"><Label htmlFor="course-thumbnail">Thumbnail URL <span className="text-muted-foreground">(optional)</span></Label><Input id="course-thumbnail" type="url" value={form.thumbnail} onChange={(event) => updateField("thumbnail", event.target.value)} /></div>
          <Button type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? "Creating..." : "Create course"}</Button>
        </form></CardContent></Card>
        <div className="space-y-6"><Card><CardHeader><div className="flex items-center justify-between"><div><CardTitle>Course catalog</CardTitle><CardDescription>{coursesQuery.data?.length || 0} courses configured</CardDescription></div><BookOpen className="h-5 w-5 text-muted-foreground" /></div></CardHeader><CardContent><div className="divide-y">{coursesQuery.data?.map((course) => <div key={course.id} className="flex items-center justify-between gap-4 py-4"><div className="min-w-0"><p className="font-medium">{course.title}</p><p className="truncate text-sm text-muted-foreground">{course.description}</p><div className="mt-2 flex gap-2"><Badge variant="outline">{course.enrollmentMode === "restricted" ? "Instructor enrollment" : "Self-enrollment"}</Badge><Badge variant="secondary">Published</Badge></div></div><Button variant="ghost" size="icon" aria-label={`Delete ${course.title}`} onClick={() => deleteMutation.mutate(course.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>)}</div></CardContent></Card>
        <Card><CardHeader><CardTitle>Create module</CardTitle><CardDescription>Add learning content to a course.</CardDescription></CardHeader><CardContent><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); createModuleMutation.mutate(); }}><div className="space-y-2"><Label htmlFor="module-course">Course</Label><select id="module-course" className="flex h-10 w-full rounded-md border bg-background px-3 text-sm" value={moduleForm.courseId} onChange={(event) => setModuleForm({ ...moduleForm, courseId: event.target.value })} required><option value="">Choose a course</option>{coursesQuery.data?.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}</select></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="module-title">Title</Label><Input id="module-title" value={moduleForm.title} onChange={(event) => setModuleForm({ ...moduleForm, title: event.target.value })} required /></div><div className="space-y-2"><Label htmlFor="module-order">Order</Label><Input id="module-order" type="number" min="1" value={moduleForm.order} onChange={(event) => setModuleForm({ ...moduleForm, order: event.target.value })} required /></div></div><div className="space-y-2"><Label htmlFor="module-content">Content</Label><textarea id="module-content" className="min-h-32 w-full rounded-md border bg-background px-3 py-2 text-sm" value={moduleForm.content} onChange={(event) => setModuleForm({ ...moduleForm, content: event.target.value })} required /></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="module-duration">Duration (minutes)</Label><Input id="module-duration" type="number" min="1" value={moduleForm.duration} onChange={(event) => setModuleForm({ ...moduleForm, duration: event.target.value })} required /></div><div className="space-y-2"><Label htmlFor="module-prerequisite">Prerequisite</Label><select id="module-prerequisite" className="flex h-10 w-full rounded-md border bg-background px-3 text-sm" value={moduleForm.prerequisiteModuleId} onChange={(event) => setModuleForm({ ...moduleForm, prerequisiteModuleId: event.target.value })}><option value="">None</option>{modulesQuery.data?.map((module) => <option key={module.id} value={module.id}>{module.order}. {module.title}</option>)}</select></div></div><Button type="submit" disabled={createModuleMutation.isPending}>{createModuleMutation.isPending ? "Creating..." : "Create module"}</Button></form>{modulesQuery.data && <div className="mt-6 divide-y border-t">{modulesQuery.data.map((module) => <div key={module.id} className="flex items-center justify-between py-3"><div><p className="text-sm font-medium">{module.order}. {module.title}</p><p className="text-xs text-muted-foreground">{module.duration} minutes</p></div><Button variant="ghost" size="icon" aria-label={`Delete ${module.title}`} onClick={() => deleteModuleMutation.mutate(module.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>)}</div>}</CardContent></Card>
        <Card><CardHeader><div className="flex items-center justify-between"><div><CardTitle>Enroll a student</CardTitle><CardDescription>Staff can add students to restricted courses.</CardDescription></div><Users className="h-5 w-5 text-muted-foreground" /></div></CardHeader><CardContent><form className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); enrollMutation.mutate(); }}><div className="space-y-2"><Label htmlFor="enroll-student">Student</Label><select id="enroll-student" className="flex h-10 w-full rounded-md border bg-background px-3 text-sm" value={enrollment.userId} onChange={(event) => setEnrollment({ ...enrollment, userId: event.target.value })} required><option value="">Choose a student</option>{usersQuery.data?.filter((account) => account.role === "student").map((account) => <option key={account.id} value={account.id}>{account.fullName} ({account.email})</option>)}</select></div><div className="space-y-2"><Label htmlFor="enroll-course">Course</Label><select id="enroll-course" className="flex h-10 w-full rounded-md border bg-background px-3 text-sm" value={enrollment.courseId} onChange={(event) => setEnrollment({ ...enrollment, courseId: event.target.value })} required><option value="">Choose a course</option>{coursesQuery.data?.filter((course) => course.enrollmentMode === "restricted").map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}</select></div><Button type="submit" className="sm:col-span-2" disabled={enrollMutation.isPending}>{enrollMutation.isPending ? "Enrolling..." : "Enroll student"}</Button></form></CardContent></Card>
        <Card><CardHeader><div className="flex items-center justify-between"><div><CardTitle>Users</CardTitle><CardDescription>Accounts available for enrollment management</CardDescription></div><Users className="h-5 w-5 text-muted-foreground" /></div></CardHeader><CardContent><div className="divide-y">{usersQuery.data?.map((account) => <div key={account.id} className="flex items-center justify-between py-3"><div><p className="font-medium">{account.fullName}</p><p className="text-sm text-muted-foreground">{account.email}</p></div><Badge variant="outline" className="capitalize">{account.role}</Badge></div>)}</div></CardContent></Card></div>
      </div>
    </main></div>
  );
}
