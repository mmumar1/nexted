import { useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Navbar } from "@/components/navbar";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, Menu } from "lucide-react";
import { Link } from "wouter";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { useAuth } from "@/lib/auth-context";
import type { Module, Course, ModuleCompletion } from "@shared/schema";
import { ModuleContent } from "@/components/course/module-content";
import { ModuleSidebar, type CourseModuleItem } from "@/components/course/module-sidebar";
import { isModuleUnlocked } from "@/lib/access-rules";
import { compareModuleOrder } from "@/lib/module-utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function CoursePage() {
  const [, legacyParams] = useRoute("/course/:id");
  const [, moduleParams] = useRoute("/course/:courseId/module/:moduleId");
  const [, setLocation] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const courseId = moduleParams?.courseId || legacyParams?.id || "1";
  const requestedModuleId = moduleParams?.moduleId;

  useEffect(() => {
    if (!isAuthenticated) {
      setLocation("/login");
    }
  }, [isAuthenticated, setLocation]);

  const { data: course } = useQuery<Course>({
    queryKey: ["/api/courses", courseId],
    enabled: !!courseId,
  });

  const { data: modules, isLoading: modulesLoading } = useQuery<(Module & { hasQuiz: boolean })[]>({
    queryKey: ["/api/modules/course", courseId],
    enabled: !!courseId,
  });

  const { data: completions } = useQuery<ModuleCompletion[]>({
    queryKey: ["/api/module-completions", user?.id, courseId],
    enabled: !!user?.id && !!courseId,
  });

  const { data: quizProgress } = useQuery<{ passedModuleIds: string[] }>({
    queryKey: ["/api/quiz-progress", user?.id, courseId],
    enabled: !!user?.id && !!courseId,
  });

  const { data: dashboardCourses } = useQuery<Array<{ id: string; isUnlocked: boolean }>>({
    queryKey: ["/api/dashboard", user?.id],
    enabled: !!user?.id,
  });

  const startUpgrade = useMutation({
    mutationFn: () => apiRequest("POST", "/api/payments/paystack/initialize"),
    onSuccess: (result: { authorizationUrl: string }) => window.location.assign(result.authorizationUrl),
    onError: (error: Error) => toast({ title: "Checkout could not start", description: error.message, variant: "destructive" }),
  });

  if (!user) return null;

  const hasActiveSubscription = !!user.hasActiveSubscription;
  const hasCourseAccess = true;

  const completedModuleIds = new Set(
    completions?.map((completion) => completion.moduleId) || []
  );
  const passedQuizModuleIds = new Set(quizProgress?.passedModuleIds || []);

  const orderedModules = [...(modules ?? [])].sort((a, b) => compareModuleOrder(a, b, modules ?? []));
  const baseModulesWithCompletion: CourseModuleItem[] =
    orderedModules.map((m) => ({
      ...m,
      isCompleted: completedModuleIds.has(m.id) || (m.hasQuiz && passedQuizModuleIds.has(m.id)),
      isLocked: false,
      requiresSubscription: false,
      hasQuiz: m.hasQuiz,
      isQuizPassed: passedQuizModuleIds.has(m.id),
    })) || [];

  const moduleMap = new Map(baseModulesWithCompletion.map((module) => [module.id, module]));

  const modulesWithCompletion: CourseModuleItem[] = baseModulesWithCompletion.map((module, index) => {
    const prerequisiteModule = module.prerequisiteModuleId ? moduleMap.get(module.prerequisiteModuleId) : undefined;
    const hasUnpassedPreviousQuiz = baseModulesWithCompletion
      .slice(0, index)
      .some((previousModule) => previousModule.hasQuiz && !previousModule.isQuizPassed);
    const requiresSubscription = !hasActiveSubscription
      && module.order > 2
      && !hasUnpassedPreviousQuiz
      && (!module.prerequisiteModuleId || !!prerequisiteModule?.isQuizPassed);
    const isLocked = !isModuleUnlocked({
      hasUnpassedPreviousQuiz,
      hasPrerequisiteQuiz: !!prerequisiteModule?.hasQuiz,
      prerequisiteQuizPassed: !!prerequisiteModule?.isQuizPassed,
      hasActiveSubscription,
      isModuleWithinFreeTier: module.order <= 2,
    });

    return {
      ...module,
      isLocked,
      requiresSubscription,
    };
  });

  const accessibleModules = modulesWithCompletion.filter((module) => !module.isLocked);
  const firstIncompleteModule = accessibleModules.find((module) => !module.isCompleted);
  const requestedModule = modulesWithCompletion.find((module) => module.id === requestedModuleId);
  const activeModule = requestedModule && !requestedModule.isLocked
    ? requestedModule
    : firstIncompleteModule || accessibleModules[0];
  const activeModuleIndex = activeModule
    ? modulesWithCompletion.findIndex((module) => module.id === activeModule.id)
    : -1;
  const previousModule = activeModuleIndex > 0 ? modulesWithCompletion[activeModuleIndex - 1] : undefined;
  const nextModuleCandidate = activeModuleIndex >= 0 ? modulesWithCompletion[activeModuleIndex + 1] : undefined;
  const nextModule = nextModuleCandidate && !nextModuleCandidate.isLocked ? nextModuleCandidate : undefined;
  const courseCompleted = modulesWithCompletion.length > 0 && modulesWithCompletion.every((module) => module.isCompleted && (!module.hasQuiz || module.isQuizPassed));

  const completedCount = modulesWithCompletion.filter((m) => m.isCompleted).length;
  const progress = modulesWithCompletion.length > 0
    ? (completedCount / modulesWithCompletion.length) * 100
    : 0;

  const handleTakeQuiz = (moduleId: string) => {
    setLocation(`/quiz/${moduleId}`);
  };

  const handleSelectModule = (moduleId: string) => {
    setLocation(`/course/${courseId}/module/${moduleId}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {!hasCourseAccess ? (
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-8 text-center">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-amber-700 dark:text-amber-300">Course access</p>
            <h2 className="mt-4 text-3xl font-bold text-foreground">The free tier includes modules 1 and 2</h2>
            <p className="mt-3 text-muted-foreground">Subscribe to unlock the full course experience.</p>
            <div className="mt-6 flex justify-center gap-3">
              <Link href="/dashboard">
                <Button>Back to dashboard</Button>
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <>
      {/* Course Header */}
      <div className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 hover-elevate px-2 py-1 rounded-md" data-testid="link-back-dashboard">
            <ChevronLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>

          {course ? (
            <>
              <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
                {course.title}
              </h1>
              <p className="text-lg text-muted-foreground mb-6">
                {course.description}
              </p>
            </>
          ) : (
            <>
              <Skeleton className="h-10 w-3/4 mb-3" />
              <Skeleton className="h-6 w-full mb-6" />
            </>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Overall Progress</span>
              <span className="font-medium text-foreground">
                {completedCount} of {modulesWithCompletion.length} modules completed
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </div>
      </div>

      {/* Modules */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-foreground mb-2">Course Modules</h2>
            <p className="text-muted-foreground">Work through each module and complete the quizzes to track your progress</p>
          </div>
          <Drawer>
            <DrawerTrigger asChild>
              <Button variant="outline" className="gap-2 lg:hidden"><Menu className="h-4 w-4" /> Modules</Button>
            </DrawerTrigger>
            <DrawerContent>
              <DrawerHeader><DrawerTitle>Course modules</DrawerTitle></DrawerHeader>
              <div className="overflow-y-auto px-4 pb-6">
                <ModuleSidebar modules={modulesWithCompletion} activeModuleId={activeModule?.id} onSelect={handleSelectModule} />
              </div>
            </DrawerContent>
          </Drawer>
        </div>

        {modulesLoading ? (
          <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
            <Skeleton className="h-80 w-full" />
            <Skeleton className="h-[28rem] w-full" />
          </div>
        ) : activeModule ? (
          <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
            <ModuleSidebar
              modules={modulesWithCompletion}
              activeModuleId={activeModule.id}
              onSelect={handleSelectModule}
            />
            {courseCompleted && (
              <div className="rounded-lg border border-chart-3/30 bg-chart-3/10 p-4 text-sm text-foreground lg:col-start-2">
                You completed this course. Great work.
              </div>
            )}
            <ModuleContent
              module={activeModule}
              previousModule={previousModule}
              nextModule={nextModule}
              requiresSubscription={!!nextModuleCandidate?.requiresSubscription}
              isStartingUpgrade={startUpgrade.isPending}
              onTakeQuiz={() => handleTakeQuiz(activeModule.id)}
              onSelectModule={handleSelectModule}
              onUpgrade={() => startUpgrade.mutate()}
              onRedeemCoupon={() => setLocation("/profile?upgrade=1")}
            />
          </div>
        ) : (
          <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
            No modules are available for this course yet.
          </div>
        )}
      </div>
      </>
      )}
    </div>
  );
}
