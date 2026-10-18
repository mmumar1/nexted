import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, CalendarDays, ClipboardList } from "lucide-react";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";

interface LearningPlaceholderProps {
  feature: "events" | "cbt";
}

const featureContent = {
  events: {
    title: "Events",
    description: "See upcoming learning events here once event publishing and calendar reminders are available.",
    Icon: CalendarDays,
  },
  cbt: {
    title: "CBT practice",
    description: "JAMB-style mock tests and practice sessions will be available here once the CBT question bank and test engine are ready.",
    Icon: ClipboardList,
  },
};

export default function LearningPlaceholder({ feature }: LearningPlaceholderProps) {
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();
  const content = featureContent[feature];
  const Icon = content.Icon;

  useEffect(() => {
    if (!isAuthenticated) setLocation("/login");
  }, [isAuthenticated, setLocation]);

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <Button asChild variant="ghost" className="mb-5">
          <Link href="/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to dashboard
          </Link>
        </Button>
        <Card>
          <CardHeader className="items-center text-center">
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Icon className="h-6 w-6" />
            </div>
            <CardTitle>{content.title}</CardTitle>
            <CardDescription>{content.description}</CardDescription>
          </CardHeader>
          <CardContent className="text-center text-sm text-muted-foreground">
            This section is planned and is not available yet.
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
