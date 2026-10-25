import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Navbar } from "@/components/navbar";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Lock, Play, BookOpen, Trophy, CheckCircle2, Bell, Medal } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { apiRequest } from "@/lib/queryClient";
import { canAccessCourse } from "@/lib/access-rules";
import type { AnnouncementRecord } from "@/lib/announcements";

interface CourseWithProgress {
  id: string;
  title: string;
  description: string;
  thumbnail: string | null;
  accessCode: string;
  isUnlocked: boolean;
  progress?: number;
  totalModules?: number;
  completedModules?: number;
}

interface LeaderboardTier {
  id: "gold" | "silver" | "bronze";
  label: string;
  minimumScore: number;
  description: string;
}

interface LeaderboardStatus {
  overallScore: number;
  tier: LeaderboardTier["id"];
  quizzesTaken: number;
  totalQuestions: number;
  tiers: LeaderboardTier[];
}

interface SavedCourseOrder {
  courseIds: string[];
  lastRotationWeek: number;
}

const COURSE_ORDER_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function orderDashboardCourses(
  courses: CourseWithProgress[],
  userId: string,
): CourseWithProgress[] {
  const activeCourses = courses.filter((course) => (course.progress || 0) > 0);
  const notStartedCourses = courses.filter((course) => !(course.progress && course.progress > 0));
  const storageKey = `dashboard-course-order:${userId}`;
  const currentWeek = Math.floor(Date.now() / COURSE_ORDER_WEEK_MS);

  let savedOrder: SavedCourseOrder | undefined;
  try {
    const storedValue = window.localStorage.getItem(storageKey);
    if (storedValue) {
      const parsed: unknown = JSON.parse(storedValue);
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        "courseIds" in parsed &&
        Array.isArray(parsed.courseIds) &&
        parsed.courseIds.every((id) => typeof id === "string") &&
        "lastRotationWeek" in parsed &&
        typeof parsed.lastRotationWeek === "number"
      ) {
        savedOrder = {
          courseIds: parsed.courseIds,
          lastRotationWeek: parsed.lastRotationWeek,
        };
      }
    }
  } catch (error) {
    console.warn("Could not read the saved dashboard course order:", error);
    return courses;
  }

  const availableIds = new Set(notStartedCourses.map((course) => course.id));
  const orderedIds = savedOrder
    ? savedOrder.courseIds.filter((id, index, ids) => availableIds.has(id) && ids.indexOf(id) === index)
    : [];

  for (const course of notStartedCourses) {
    if (!orderedIds.includes(course.id)) orderedIds.push(course.id);
  }

  if (!savedOrder) {
    orderedIds.sort((firstId, secondId) => {
      const firstRank = hashString(`${userId}:${currentWeek}:${firstId}`);
      const secondRank = hashString(`${userId}:${currentWeek}:${secondId}`);
      return firstRank - secondRank || firstId.localeCompare(secondId);
    });
  } else if (savedOrder.lastRotationWeek < currentWeek && orderedIds.length > 1) {
    const swapIndex = hashString(`${userId}:${currentWeek}`) % (orderedIds.length - 1);
    [orderedIds[swapIndex], orderedIds[swapIndex + 1]] = [
      orderedIds[swapIndex + 1],
      orderedIds[swapIndex],
    ];
  }

  try {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ courseIds: orderedIds, lastRotationWeek: currentWeek }),
    );
  } catch (error) {
    console.warn("Could not save the dashboard course order:", error);
    return courses;
  }

  const coursesById = new Map(notStartedCourses.map((course) => [course.id, course]));
  const orderedNotStartedCourses = orderedIds
    .map((id) => coursesById.get(id))
    .filter((course): course is CourseWithProgress => course !== undefined);

  return [...activeCourses, ...orderedNotStartedCourses];
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const [orderedCoursesState, setOrderedCoursesState] = useState<{
    userId: string;
    courses: CourseWithProgress[];
  } | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setLocation("/login");
    }
  }, [isAuthenticated, setLocation]);

  const { data: courses, isLoading, isError, refetch } = useQuery<CourseWithProgress[]>({
    queryKey: ["/api/dashboard", user?.id],
    enabled: !!user?.id,
  });

  const { data: leaderboard } = useQuery<LeaderboardStatus>({
    queryKey: ["/api/dashboard", user?.id, "leaderboard"],
    queryFn: () => apiRequest("GET", `/api/dashboard/${user?.id}/leaderboard`),
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (!user?.id || !courses) {
      setOrderedCoursesState(null);
      return;
    }
    setOrderedCoursesState({
      userId: user.id,
      courses: orderDashboardCourses(courses, user.id),
    });
  }, [courses, user?.id]);

  if (!user) return null;

  const displayedCourses =
    orderedCoursesState?.userId === user.id ? orderedCoursesState.courses : courses;
  const userName = user.fullName;
  const hasSubscriptionAccess = !!user?.hasActiveSubscription;
  const unlockedCount = courses?.filter((c) => canAccessCourse({ hasActiveSubscription: hasSubscriptionAccess, isUnlocked: c.isUnlocked })).length || 0;
  const totalCompleted = courses?.reduce((sum, c) => sum + (c.completedModules || 0), 0) || 0;
  const continueCourses = courses?.filter((course) => canAccessCourse({ hasActiveSubscription: hasSubscriptionAccess, isUnlocked: course.isUnlocked }) && (course.progress || 0) > 0 && (course.progress || 0) < 100) || [];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-background to-accent/10">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              Welcome back, {userName.split(" ")[0]}!
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8">
              Continue your learning journey and achieve your goals
            </p>
            {hasSubscriptionAccess ? (
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="h-4 w-4" />
                One-time subscription active: all courses unlocked.
              </div>
            ) : (
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1.5 text-sm font-medium text-amber-700 dark:text-amber-300">
                <Lock className="h-4 w-4" />
                Free tier access includes modules 1 and 2; upgrade for full access.
              </div>
            )}
            
            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="border-card-border bg-card/50 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-primary/10 rounded-md">
                      <BookOpen className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">{unlockedCount}</p>
                      <p className="text-sm text-muted-foreground">Courses Unlocked</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-card-border bg-card/50 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-chart-3/10 rounded-md">
                      <CheckCircle2 className="w-6 h-6 text-chart-3" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">{totalCompleted}</p>
                      <p className="text-sm text-muted-foreground">Modules Completed</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-card-border bg-card/50 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-chart-4/10 rounded-md">
                      <Trophy className="w-6 h-6 text-chart-4" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold capitalize text-foreground">{leaderboard?.tier || "Bronze"}</p>
                      <p className="text-sm text-muted-foreground">Current Tier</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {continueCourses.length > 0 && (
        <section className="border-b bg-muted/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-foreground">Continue learning</h2>
              <p className="text-sm text-muted-foreground">Pick up where you left off</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {continueCourses.map((course) => (
                <Link key={course.id} href={`/course/${course.id}`} className="rounded-lg border bg-card p-4 transition-colors hover:bg-muted">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-foreground">{course.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{course.completedModules} of {course.totalModules} modules completed</p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-primary">{course.progress}%</span>
                  </div>
                  <Progress value={course.progress} className="mt-3 h-1.5" />
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Courses Section */}
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:px-8">
        <main className="min-w-0">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-foreground mb-2">Your Courses</h2>
          <p className="text-muted-foreground">
            Continue learning and complete your modules across the learning catalog.
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="border-card-border">
                <Skeleton className="aspect-video w-full" />
                <CardHeader>
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-full" />
                </CardHeader>
                <CardFooter>
                  <Skeleton className="h-10 w-full" />
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : isError ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center">
            <p className="font-medium text-foreground">We could not load your courses.</p>
            <p className="mt-1 text-sm text-muted-foreground">Check your connection and try again.</p>
            <Button variant="secondary" className="mt-4" onClick={() => refetch()}>Try again</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayedCourses?.map((course) => (
              <Card
                key={course.id}
                className={`border-card-border overflow-hidden transition-all hover-elevate ${
                  !course.isUnlocked ? "opacity-90" : ""
                }`}
              >
                {/* Course Thumbnail */}
                <div className="relative aspect-video overflow-hidden bg-gradient-to-br from-primary/20 to-accent/20">
                  {course.thumbnail && (
                    <img
                      src={course.thumbnail}
                      alt={course.title}
                      className={`w-full h-full object-cover ${
                        !course.isUnlocked ? "blur-sm" : ""
                      }`}
                    />
                  )}
                  {!course.isUnlocked && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <Lock className="w-12 h-12 text-white" />
                    </div>
                  )}
                  {course.isUnlocked && course.progress !== undefined && (
                    <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/60 to-transparent">
                      <Progress value={course.progress} className="h-1.5" />
                    </div>
                  )}
                </div>

                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-xl">{course.title}</CardTitle>
                    {canAccessCourse({ hasActiveSubscription: hasSubscriptionAccess, isUnlocked: course.isUnlocked }) ? (
                      <Badge variant="secondary" className="shrink-0 text-xs">
                        {course.progress === 100 ? "Completed" : course.progress ? "In progress" : "Not started"}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="shrink-0 text-xs">Locked</Badge>
                    )}
                  </div>
                  <CardDescription className="text-sm leading-relaxed">
                    {course.description}
                  </CardDescription>
                </CardHeader>

                {course.isUnlocked && course.totalModules && (
                  <CardContent className="pb-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="w-4 h-4 text-chart-3" />
                      <span>
                        {course.completedModules} of {course.totalModules} modules completed
                      </span>
                    </div>
                  </CardContent>
                )}

                <CardFooter className="pt-3">
                  <Link href={`/course/${course.id}`} className="w-full">
                    <Button className="w-full gap-2" data-testid={`button-continue-course-${course.id}`}>
                      <Play className="w-4 h-4" />
                      Continue Learning
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
        </main>

        <DashboardSidebar leaderboard={leaderboard} />
      </div>

    </div>
  );
}

function DashboardSidebar({ leaderboard }: { leaderboard?: LeaderboardStatus }) {
  const { data: announcements = [] } = useQuery<AnnouncementRecord[]>({ queryKey: ["/api/announcements"] });

  const activeTier = leaderboard?.tier || "bronze";
  const tierStyles: Record<LeaderboardTier["id"], string> = {
    gold: "border-amber-300/60 bg-amber-50 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100",
    silver: "border-slate-300/70 bg-slate-50 text-slate-900 dark:bg-slate-900/40 dark:text-slate-100",
    bronze: "border-orange-300/60 bg-orange-50 text-orange-950 dark:bg-orange-950/30 dark:text-orange-100",
  };

  const tiers: LeaderboardTier[] = leaderboard?.tiers || [
    { id: "gold", label: "Gold", minimumScore: 80, description: "Outstanding performance" },
    { id: "silver", label: "Silver", minimumScore: 60, description: "Strong progress" },
    { id: "bronze", label: "Bronze", minimumScore: 0, description: "Keep building your skills" },
  ];

  return (
    <aside className="hidden space-y-5 lg:sticky lg:top-24 lg:block lg:self-start">
      <Card className="hidden lg:block">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Announcements</CardTitle>
          </div>
          <CardDescription>Updates from your learning team</CardDescription>
        </CardHeader>
        <CardContent>
          {announcements.length === 0 ? (
            <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              No announcements yet.
            </div>
          ) : (
            <Accordion type="single" collapsible className="space-y-3">
              {announcements.map((announcement) => (
                <AccordionItem key={announcement.id} value={announcement.id} className="rounded-md border bg-muted/20 px-3">
                  <AccordionTrigger className="text-left text-sm">
                    <div className="flex w-full flex-col items-start gap-1 pr-2">
                      <span className="font-medium">{announcement.title}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(announcement.createdAt).toLocaleDateString([], { month: "short", day: "numeric" })}
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

      <Card className="hidden lg:block">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Medal className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Quiz leaderboard</CardTitle>
          </div>
          <CardDescription>Based on your combined quiz performance</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md bg-muted/60 p-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Current tier</p>
                <p className="text-xl font-bold capitalize">{activeTier}</p>
              </div>
              <p className="text-2xl font-bold tabular-nums">{leaderboard?.overallScore || 0}%</p>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{leaderboard?.quizzesTaken || 0} quiz attempts across your courses</p>
          </div>
          {tiers.map((tier) => (
            <div key={tier.id} className={`rounded-md border p-3 ${tierStyles[tier.id]} ${activeTier === tier.id ? "ring-2 ring-primary/40" : "opacity-75"}`}>
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold">{tier.label}</p>
                <p className="text-sm font-medium">{tier.minimumScore}%+</p>
              </div>
              <p className="mt-1 text-xs opacity-80">{tier.description}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </aside>
  );
}
