import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, BookOpen, CalendarClock, CalendarDays, ClipboardList, FolderKanban, LayoutDashboard, LogOut, Medal, Menu, MessageCircle, Moon, Sun } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { WhatsAppFloat } from "@/components/whatsapp-float";
import { useAuth } from "@/lib/auth-context";
import type { AnnouncementRecord } from "@/lib/announcements";
import { apiRequest } from "@/lib/queryClient";

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

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/courses", label: "My Courses", icon: BookOpen },
  { href: "/projects", label: "Projects", icon: FolderKanban },
];

export function Navbar() {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const [isDarkMode, setIsDarkMode] = useState(() => window.localStorage.getItem("beehub-theme") === "dark");
  const [now, setNow] = useState(() => new Date());
  const { data: announcements = [], isLoading: announcementsLoading, isError: announcementsError } = useQuery<AnnouncementRecord[]>({
    queryKey: ["/api/announcements"],
    enabled: !!user,
  });
  const { data: leaderboard, isLoading: leaderboardLoading, isError: leaderboardError } = useQuery<LeaderboardStatus>({
    queryKey: ["/api/dashboard", user?.id, "leaderboard"],
    queryFn: () => apiRequest("GET", `/api/dashboard/${user?.id}/leaderboard`),
    enabled: !!user?.id,
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDarkMode);
    window.localStorage.setItem("beehub-theme", isDarkMode ? "dark" : "light");
  }, [isDarkMode]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const handleLogout = () => {
    logout();
    setLocation("/");
  };

  const userName = user?.fullName || "Student";
  const staffNavItems = user?.role && ["admin", "super_admin", "instructor"].includes(user.role)
    ? [...navItems, { href: "/admin", label: "Admin CMS", icon: LayoutDashboard }]
    : navItems;
  const activeTier = leaderboard?.tiers?.find((tier) => tier.id === leaderboard.tier);
  const showWhatsAppButton = ["/dashboard", "/courses", "/projects", "/profile"].includes(location)
    || location.startsWith("/course/")
    || location.startsWith("/quiz/");

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto max-w-7xl px-2 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link href="/dashboard" className="flex shrink-0 items-center gap-2 rounded-md px-1 py-1 hover-elevate sm:px-2" data-testid="link-home">
            <span className="text-sm font-bold text-foreground min-[380px]:text-base sm:text-lg">Learnpedia</span>
          </Link>

          <div className="hidden items-center gap-1 md:flex">
            {staffNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.href;

              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    className="gap-2"
                    data-testid={`link-${item.label.toLowerCase().replace(" ", "-")}`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Button>
                </Link>
              );
            })}
          </div>

          <div className="flex shrink-0 items-center gap-0 sm:gap-1">
            {(user?.role === "student" || user?.role === "instructor") && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="max-[380px]:h-9 max-[380px]:w-9" aria-label="Messages">
                    <MessageCircle className="h-5 w-5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))]">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="h-4 w-4 text-primary" />
                    <h2 className="font-semibold">Messages</h2>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Course messaging is coming soon. You’ll be able to contact instructors and manage course conversations here.
                  </p>
                </PopoverContent>
              </Popover>
            )}

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative max-[380px]:h-9 max-[380px]:w-9 lg:hidden" aria-label="View announcements">
                  <Bell className="h-5 w-5" />
                  {announcements.length > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground">
                      {announcements.length > 9 ? "9+" : announcements.length}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))] p-0">
                <div className="border-b p-4">
                  <p className="font-semibold">Announcements</p>
                  <p className="text-sm text-muted-foreground">Updates from your learning team</p>
                </div>
                <div className="max-h-[min(65vh,28rem)] space-y-3 overflow-y-auto p-3">
                  {announcementsLoading ? (
                    <p className="p-2 text-sm text-muted-foreground">Loading announcements...</p>
                  ) : announcementsError ? (
                    <p className="p-2 text-sm text-destructive">Announcements could not be loaded. Please try again.</p>
                  ) : announcements.length === 0 ? (
                    <p className="p-2 text-sm text-muted-foreground">No announcements yet.</p>
                  ) : announcements.map((announcement) => (
                    <article key={announcement.id} className="rounded-md border bg-muted/20 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-sm font-medium">{announcement.title}</h3>
                        <time className="shrink-0 text-[11px] text-muted-foreground">
                          {new Date(announcement.createdAt).toLocaleDateString([], { month: "short", day: "numeric" })}
                        </time>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-5 text-muted-foreground">{announcement.message}</p>
                    </article>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative max-[380px]:h-9 max-[380px]:w-9 lg:hidden" aria-label="View quiz leaderboard">
                  <Medal className="h-5 w-5" />
                  {leaderboard && (
                    <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold leading-none text-primary-foreground">
                      {Math.round(leaderboard.overallScore)}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))]">
                <div className="flex items-center gap-2">
                  <Medal className="h-4 w-4 text-primary" />
                  <h2 className="font-semibold">Quiz leaderboard</h2>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">Based on your combined quiz performance</p>
                {leaderboardLoading ? (
                  <p className="mt-4 text-sm text-muted-foreground">Loading leaderboard...</p>
                ) : leaderboardError ? (
                  <p className="mt-4 text-sm text-destructive">Leaderboard could not be loaded. Please try again.</p>
                ) : (
                  <>
                    <div className="mt-4 rounded-md bg-muted/60 p-3">
                      <div className="flex items-end justify-between gap-3">
                        <div>
                          <p className="text-xs text-muted-foreground">Current tier</p>
                          <p className="text-xl font-bold capitalize">{leaderboard?.tier || "Bronze"}</p>
                        </div>
                        <p className="text-2xl font-bold tabular-nums">{leaderboard?.overallScore || 0}%</p>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {leaderboard?.quizzesTaken || 0} quiz attempts across your courses
                      </p>
                    </div>
                    {activeTier && (
                      <div className="mt-3 rounded-md border p-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-medium">{activeTier.label} tier</p>
                          <p className="text-sm">{activeTier.minimumScore}%+</p>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{activeTier.description}</p>
                      </div>
                    )}
                  </>
                )}
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-9 gap-1.5 px-2 max-[380px]:h-9 max-[380px]:w-9 max-[380px]:px-0 lg:hidden"
                  aria-label={`Current date and time: ${now.toLocaleString()}`}
                >
                  <CalendarClock className="h-4 w-4 shrink-0" />
                  <span className="hidden text-xs tabular-nums min-[380px]:inline">
                    {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64">
                <div className="flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-primary" />
                  <h2 className="font-semibold">Local date and time</h2>
                </div>
                <p className="mt-3 text-2xl font-semibold tabular-nums">
                  {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                </p>
              </PopoverContent>
            </Popover>

            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="max-[380px]:h-9 max-[380px]:w-9" aria-label="Open navigation menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[min(20rem,85vw)] overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Menu</SheetTitle>
                  <SheetDescription>
                    {userName} · {user?.role || "Student"} account
                  </SheetDescription>
                </SheetHeader>
                <div className="my-5 space-y-1">
                  <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Learning</p>
                  <SheetClose asChild>
                    <Link
                      href="/events"
                      className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground ${location === "/events" ? "bg-accent text-accent-foreground" : ""}`}
                      data-testid="link-events"
                    >
                      <CalendarDays className="h-4 w-4" />
                      Events
                    </Link>
                  </SheetClose>
                  <SheetClose asChild>
                    <Link
                      href="/cbt"
                      className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground ${location === "/cbt" ? "bg-accent text-accent-foreground" : ""}`}
                      data-testid="link-cbt"
                    >
                      <ClipboardList className="h-4 w-4" />
                      CBT practice
                    </Link>
                  </SheetClose>
                </div>
                <div className="my-5 border-t" />
                <nav className="mt-6 space-y-1">
                  {staffNavItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <SheetClose key={item.href} asChild>
                        <Link
                          href={item.href}
                          className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground ${location === item.href ? "bg-accent text-accent-foreground" : ""}`}
                        >
                          <Icon className="h-4 w-4" />
                          {item.label}
                        </Link>
                      </SheetClose>
                    );
                  })}
                </nav>
                <div className="my-5 border-t" />
                <div className="space-y-1">
                  <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Account</p>
                  <SheetClose asChild>
                    <Link href="/profile" className="block rounded-md px-3 py-2.5 text-sm font-medium hover:bg-accent">
                      Profile &amp; settings
                    </Link>
                  </SheetClose>
                  <SheetClose asChild>
                    <Link href="/profile#payment-options" className="block rounded-md px-3 py-2.5 text-sm font-medium hover:bg-accent">
                      Payment
                    </Link>
                  </SheetClose>
                  <SheetClose asChild>
                    <Link href="/profile#coupon-code" className="block rounded-md px-3 py-2.5 text-sm font-medium hover:bg-accent">
                      Redeem a coupon
                    </Link>
                  </SheetClose>
                </div>
                <div className="my-5 border-t" />
                <div className="flex items-center justify-between px-3 py-2">
                  <div className="flex items-center gap-3">
                    {isDarkMode ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                    <span className="text-sm font-medium">Dark mode</span>
                  </div>
                  <Switch
                    checked={isDarkMode}
                    onCheckedChange={setIsDarkMode}
                    aria-label="Toggle dark mode"
                  />
                </div>
                <div className="my-5 border-t" />
                <SheetClose asChild>
                  <Button
                    variant="ghost"
                    onClick={handleLogout}
                    className="w-full justify-start text-destructive hover:text-destructive"
                    data-testid="button-logout"
                  >
                    <LogOut className="mr-3 h-4 w-4" />
                    Logout
                  </Button>
                </SheetClose>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
      {showWhatsAppButton && <WhatsAppFloat />}
    </nav>
  );
}
