import { useEffect, useState, type MouseEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, BookOpen, CalendarClock, CalendarDays, ClipboardList, Compass, FolderKanban, Handshake, LayoutDashboard, LogOut, Medal, Menu, MessageCircle, Moon, Sun } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { WhatsAppFloat } from "@/components/whatsapp-float";
import { useAuth } from "@/lib/auth-context";
import type { AnnouncementRecord } from "@/lib/announcements";
import { apiRequest } from "@/lib/queryClient";
import type { CourseConversationSummary } from "@shared/schema";

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

interface EventNotificationRecord {
  id: string;
  eventId: string;
  revision: number;
  title: string;
  startsAt: string;
  status: "published" | "cancelled";
  createdAt: string;
  readAt: string | null;
}

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  sectionId?: string;
}

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/courses#my-courses", label: "My Courses", icon: BookOpen, sectionId: "my-courses" },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/partners", label: "Become a Partner", icon: Handshake },
];

export function Navbar() {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const [isDarkMode, setIsDarkMode] = useState(() => window.localStorage.getItem("beehub-theme") === "dark");
  const [now, setNow] = useState(() => new Date());
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: announcements = [], isLoading: announcementsLoading, isError: announcementsError } = useQuery<AnnouncementRecord[]>({
    queryKey: ["/api/announcements"],
    enabled: !!user,
  });
  const { data: eventNotifications = [], isLoading: eventNotificationsLoading, isError: eventNotificationsError } = useQuery<EventNotificationRecord[]>({
    queryKey: ["/api/events/notifications", user?.id],
    queryFn: () => apiRequest("GET", "/api/events/notifications"),
    enabled: user?.role === "student",
  });
  const markEventNotificationRead = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/events/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/events/notifications", user?.id] }),
    onError: (error: Error) => toast({
      title: "Could not mark event update as read",
      description: error.message,
      variant: "destructive",
    }),
  });
  const { data: leaderboard, isLoading: leaderboardLoading, isError: leaderboardError } = useQuery<LeaderboardStatus>({
    queryKey: ["/api/dashboard", user?.id, "leaderboard"],
    queryFn: () => apiRequest("GET", `/api/dashboard/${user?.id}/leaderboard`),
    enabled: !!user?.id,
  });
  const { data: conversations = [] } = useQuery<CourseConversationSummary[]>({
    queryKey: ["/api/messages", user?.id],
    queryFn: () => apiRequest("GET", "/api/messages"),
    enabled: !!user?.id && ["student", "instructor", "admin", "super_admin", "superadmin"].includes(user.role),
    refetchInterval: 15_000,
  });
  const unreadMessageCount = conversations.reduce((count, conversation) => count + conversation.unreadCount, 0);

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
  const exploreCoursesNavItem: NavItem = {
    href: "/courses#explore-courses",
    label: "Explore Courses",
    icon: Compass,
    sectionId: "explore-courses",
  };
  const staffNavItems = user?.role && ["admin", "super_admin", "instructor"].includes(user.role)
    ? [...navItems, { href: "/admin", label: "Admin CMS", icon: LayoutDashboard }]
    : user?.role === "student"
      ? [navItems[0], navItems[1], exploreCoursesNavItem, navItems[2], navItems[3]]
      : navItems;
  const isNavItemActive = (item: NavItem) => item.sectionId
    ? location.startsWith("/courses") && window.location.hash === `#${item.sectionId}`
    : location === item.href;
  const handleCourseSectionNavigation = (sectionId: string) => (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    setLocation(`/courses#${sectionId}`);
    window.setTimeout(() => {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, location.startsWith("/courses") ? 0 : 100);
  };
  const activeTier = leaderboard?.tiers?.find((tier) => tier.id === leaderboard.tier);
  const unreadEventNotifications = eventNotifications.filter((notification) => !notification.readAt).length;
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
              const isActive = isNavItemActive(item);

              return (
                <Link key={item.href} href={item.href} onClick={item.sectionId ? handleCourseSectionNavigation(item.sectionId) : undefined}>
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
            {user && ["student", "instructor", "admin", "super_admin", "superadmin"].includes(user.role) && (
              <Link href="/messages">
                <Button variant="ghost" size="icon" className="relative max-[380px]:h-9 max-[380px]:w-9" aria-label="Messages (Beta)" title="Messages · Beta">
                  <MessageCircle className="h-5 w-5" />
                  {unreadMessageCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground">
                      {unreadMessageCount > 9 ? "9+" : unreadMessageCount}
                    </span>
                  )}
                </Button>
              </Link>
            )}

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative max-[380px]:h-9 max-[380px]:w-9 lg:hidden" aria-label="View announcements">
                  <Bell className="h-5 w-5" />
                  {announcements.length + unreadEventNotifications > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground">
                      {announcements.length + unreadEventNotifications > 9 ? "9+" : announcements.length + unreadEventNotifications}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))] p-0">
                <div className="border-b p-4">
                  <p className="font-semibold">Notifications</p>
                  <p className="text-sm text-muted-foreground">Announcements and event updates</p>
                </div>
                <div className="max-h-[min(65vh,28rem)] space-y-3 overflow-y-auto p-3">
                  <h3 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Event updates</h3>
                  {user?.role === "student" && (eventNotificationsLoading ? (
                    <p className="p-2 text-sm text-muted-foreground">Loading event updates...</p>
                  ) : eventNotificationsError ? (
                    <p role="alert" className="p-2 text-sm text-destructive">Event notifications could not be loaded. Please try again.</p>
                  ) : eventNotifications.length === 0 ? (
                    <p className="p-2 text-sm text-muted-foreground">No event updates yet.</p>
                  ) : eventNotifications.map((notification) => (
                    <button
                      type="button"
                      key={notification.id}
                      className={`w-full rounded-md border p-3 text-left hover:bg-accent/50 ${notification.readAt ? "bg-muted/20" : "border-primary/40 bg-primary/5"}`}
                      onClick={() => {
                        if (!notification.readAt) markEventNotificationRead.mutate(notification.id);
                        setLocation("/events");
                      }}
                    >
                      <span className="flex items-start justify-between gap-3">
                        <span className="text-sm font-medium">{notification.title}</span>
                        {!notification.readAt && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {notification.status === "cancelled" ? "Event cancelled" : "New or updated event"}
                        {" · "}{new Date(notification.createdAt).toLocaleDateString([], { month: "short", day: "numeric" })}
                      </span>
                    </button>
                  )))}
                  <div className="my-2 border-t" />
                  <h3 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Announcements</h3>
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
                      href="/messages"
                      className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground ${location.startsWith("/messages") ? "bg-accent text-accent-foreground" : ""}`}
                      data-testid="link-messages"
                    >
                      <MessageCircle className="h-4 w-4" />
                      Messages
                      <Badge variant="secondary" className="ml-auto">Beta</Badge>
                    </Link>
                  </SheetClose>
                  <SheetClose asChild>
                    <Link
                      href="/cbt"
                      className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground ${location.startsWith("/cbt") ? "bg-accent text-accent-foreground" : ""}`}
                      data-testid="link-cbt"
                    >
                      <ClipboardList className="h-4 w-4" />
                      CBT practice
                      <Badge variant="secondary" className="ml-auto">Beta</Badge>
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
                          onClick={item.sectionId ? handleCourseSectionNavigation(item.sectionId) : undefined}
                          className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground ${isNavItemActive(item) ? "bg-accent text-accent-foreground" : ""}`}
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
