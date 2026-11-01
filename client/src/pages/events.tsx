import { useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, CalendarPlus, Check, Clock3, MapPin, X } from "lucide-react";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { apiRequest } from "@/lib/queryClient";
import { createEventIcs, createGoogleCalendarUrl } from "@shared/event-utils";
import type { EventRecord } from "@shared/schema";

type EventPageRecord = Omit<EventRecord, "startsAt" | "endsAt" | "publishedAt" | "createdAt" | "updatedAt"> & {
  startsAt: string;
  endsAt: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

function toCalendarEvent(event: EventPageRecord): EventRecord {
  return {
    ...event,
    startsAt: new Date(event.startsAt),
    endsAt: new Date(event.endsAt),
    publishedAt: event.publishedAt ? new Date(event.publishedAt) : null,
    createdAt: new Date(event.createdAt),
    updatedAt: new Date(event.updatedAt),
  };
}

function downloadIcs(event: EventPageRecord) {
  const content = createEventIcs(toCalendarEvent(event));
  const file = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${event.title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "learnpedia-event"}.ics`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function EventCard({
  event,
  onRsvp,
  isUpdating,
}: {
  event: EventPageRecord;
  onRsvp: (eventId: string, status: "attending" | "not_attending") => void;
  isUpdating: boolean;
}) {
  const isCancelled = event.status === "cancelled";
  const isPast = new Date(event.endsAt).getTime() <= Date.now();
  return (
    <article className="rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold">{event.title}</h3>
            {isCancelled && <Badge variant="destructive">Cancelled</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Hosted by {event.authorName}</p>
        </div>
        <p className="rounded-md bg-muted/50 px-3 py-1 text-sm font-medium">{event.rsvpCount} attending</p>
      </div>
      <p className="mt-4 whitespace-pre-wrap text-sm leading-6">{event.description}</p>
      <div className="mt-4 space-y-2 text-sm text-muted-foreground">
        <p className="flex items-start gap-2">
          <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span>
            {new Date(event.startsAt).toLocaleString([], { dateStyle: "full", timeStyle: "short", timeZone: event.timezone })}
            {" – "}
            {new Date(event.endsAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short", timeZone: event.timezone })}
            <span className="block text-xs">{event.timezone}</span>
          </span>
        </p>
        {event.location && <p className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{event.location}</p>}
        {event.meetingUrl && (
          <p>
            <a className="font-medium text-primary underline" href={event.meetingUrl} target="_blank" rel="noreferrer">Open meeting link</a>
          </p>
        )}
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        {!isCancelled && !isPast && (
          <>
            <Button
              type="button"
              size="sm"
              variant={event.rsvpStatus === "attending" ? "default" : "outline"}
              disabled={isUpdating}
              onClick={() => onRsvp(event.id, event.rsvpStatus === "attending" ? "not_attending" : "attending")}
            >
              <Check className="mr-1.5 h-4 w-4" />{event.rsvpStatus === "attending" ? "Going" : "I’m going"}
            </Button>
            {event.rsvpStatus !== "not_attending" && (
              <Button type="button" size="sm" variant="ghost" disabled={isUpdating} onClick={() => onRsvp(event.id, "not_attending")}>
                <X className="mr-1.5 h-4 w-4" />Can’t go
              </Button>
            )}
          </>
        )}
        {!isCancelled && (
          <>
            <Button type="button" size="sm" variant="outline" onClick={() => downloadIcs(event)}>
              <CalendarPlus className="mr-1.5 h-4 w-4" />Download calendar file
            </Button>
            <Button asChild size="sm" variant="outline">
              <a href={createGoogleCalendarUrl(toCalendarEvent(event))} target="_blank" rel="noreferrer">Add to Google Calendar</a>
            </Button>
          </>
        )}
      </div>
      {event.rsvpStatus === "not_attending" && !isCancelled && !isPast && (
        <p className="mt-2 text-xs text-muted-foreground">You marked that you can’t attend. Change your RSVP to update it.</p>
      )}
    </article>
  );
}

export default function Events() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isAuthenticated) setLocation("/login");
  }, [isAuthenticated, setLocation]);

  const eventsQuery = useQuery<EventPageRecord[]>({
    queryKey: ["/api/events", user?.id],
    queryFn: () => apiRequest("GET", "/api/events"),
    enabled: !!user?.id && user.role === "student",
  });
  const rsvpMutation = useMutation({
    mutationFn: ({ eventId, status }: { eventId: string; status: "attending" | "not_attending" }) =>
      apiRequest("POST", `/api/events/${eventId}/rsvp`, { status }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["/api/events", user?.id] });
      void queryClient.invalidateQueries({ queryKey: ["/api/events/notifications", user?.id] });
      toast({ title: "RSVP updated" });
    },
    onError: (error: Error) => toast({ title: "Could not update RSVP", description: error.message, variant: "destructive" }),
  });

  const groups = useMemo(() => {
    const now = Date.now();
    const events = eventsQuery.data ?? [];
    return {
      upcoming: events.filter((event) => new Date(event.startsAt).getTime() > now),
      inProgress: events.filter((event) =>
        event.status === "published"
        && new Date(event.startsAt).getTime() <= now
        && new Date(event.endsAt).getTime() > now,
      ),
      past: events.filter((event) => new Date(event.endsAt).getTime() <= now)
        .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime()),
    };
  }, [eventsQuery.data]);

  if (!isAuthenticated) return null;
  if (user?.role !== "student") {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
          <Card>
            <CardHeader><CardTitle>Student events</CardTitle><CardDescription>Events are available to student accounts.</CardDescription></CardHeader>
            <CardContent><Button onClick={() => setLocation("/dashboard")}>Back to dashboard</Button></CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const renderEventList = (events: EventPageRecord[]) => (
    <div className="space-y-4">
      {events.map((event) => (
        <EventCard
          key={event.id}
          event={event}
          onRsvp={(eventId, status) => rsvpMutation.mutate({ eventId, status })}
          isUpdating={rsvpMutation.isPending}
        />
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6">
        <header>
          <p className="text-sm font-medium text-primary">Learn together</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Events</h1>
          <p className="mt-2 text-muted-foreground">Events from your learning team, open to all students. RSVP and add them to your calendar.</p>
        </header>

        {eventsQuery.isPending && <Card><CardContent className="py-10 text-center text-muted-foreground">Loading events...</CardContent></Card>}
        {eventsQuery.isError && (
          <Card>
            <CardHeader><CardTitle>Events could not be loaded</CardTitle><CardDescription>Please refresh to try again.</CardDescription></CardHeader>
          </Card>
        )}
        {!eventsQuery.isPending && !eventsQuery.isError && eventsQuery.data?.length === 0 && (
          <Card>
            <CardHeader className="items-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary"><CalendarDays className="h-6 w-6" /></div>
              <CardTitle>No events yet</CardTitle>
              <CardDescription>Published events will appear here. You’ll receive a notification when one is announced.</CardDescription>
            </CardHeader>
          </Card>
        )}

        {groups.inProgress.length > 0 && (
          <section className="space-y-3">
            <h2 className="flex items-center gap-2 text-xl font-semibold"><Clock3 className="h-5 w-5 text-primary" />Happening now</h2>
            {renderEventList(groups.inProgress)}
          </section>
        )}
        {groups.upcoming.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Upcoming</h2>
            {renderEventList(groups.upcoming)}
          </section>
        )}
        {groups.past.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Past events</h2>
            {renderEventList(groups.past)}
          </section>
        )}
      </main>
    </div>
  );
}
