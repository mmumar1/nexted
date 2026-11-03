import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, MessageCircle, Search, Send } from "lucide-react";
import { Link, useLocation, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Navbar } from "@/components/navbar";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { apiRequest } from "@/lib/queryClient";

interface Conversation {
  id: string;
  courseId: string;
  courseTitle: string;
  studentId: string;
  studentName: string;
  instructorId: string;
  instructorName: string;
  createdAt: string;
  updatedAt: string;
  unreadCount: number;
}

interface ThreadMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  body: string;
  createdAt: string;
  readAt: string | null;
}

interface ThreadResponse {
  conversation: Conversation;
  messages: ThreadMessage[];
}

interface MessageableCourse {
  id: string;
  title: string;
  instructorName: string;
}

export default function MessagesPage() {
  const [, params] = useRoute("/messages/:conversationId");
  const [, setLocation] = useLocation();
  const conversationId = params?.conversationId;
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [courseSearch, setCourseSearch] = useState("");

  useEffect(() => {
    if (!isAuthenticated) setLocation("/login");
  }, [isAuthenticated, setLocation]);

  const { data: conversations = [], isLoading: conversationsLoading, isError: conversationsError } = useQuery<Conversation[]>({
    queryKey: ["/api/messages", user?.id],
    queryFn: () => apiRequest("GET", "/api/messages"),
    enabled: !!user?.id,
    refetchInterval: 15_000,
  });

  const {
    data: messageableCourses = [],
    isLoading: coursesLoading,
    isError: coursesError,
  } = useQuery<MessageableCourse[]>({
    queryKey: ["/api/messages/courses", user?.id],
    queryFn: () => apiRequest("GET", "/api/messages/courses"),
    enabled: !!user?.id && user.role === "student",
  });

  const openCourseConversation = useMutation({
    mutationFn: (courseId: string) => apiRequest("POST", `/api/messages/course/${courseId}`),
    onSuccess: async (conversation: Conversation) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/messages", user?.id] });
      setLocation(`/messages/${conversation.id}`);
    },
    onError: (error: Error) => toast({
      title: "Could not open instructor conversation",
      description: error.message,
      variant: "destructive",
    }),
  });

  const {
    data: thread,
    isLoading: threadLoading,
    isError: threadError,
  } = useQuery<ThreadResponse>({
    queryKey: ["/api/messages", conversationId],
    queryFn: () => apiRequest("GET", `/api/messages/${conversationId}`),
    enabled: !!user?.id && !!conversationId,
    refetchInterval: 10_000,
  });

  useEffect(() => {
    if (thread && user?.id) {
      void queryClient.invalidateQueries({ queryKey: ["/api/messages", user.id] });
    }
  }, [thread?.messages.length, thread?.conversation.unreadCount, user?.id, queryClient]);

  const sendMessage = useMutation({
    mutationFn: (body: string) => apiRequest("POST", `/api/messages/${conversationId}`, { body }),
    onSuccess: async () => {
      setDraft("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/messages", conversationId] }),
        queryClient.invalidateQueries({ queryKey: ["/api/messages", user?.id] }),
      ]);
    },
    onError: (error: Error) => toast({
      title: "Message could not be sent",
      description: error.message,
      variant: "destructive",
    }),
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body || sendMessage.isPending) return;
    sendMessage.mutate(body);
  };

  if (!user) return null;

  const normalizedSearch = courseSearch.trim().toLocaleLowerCase();
  const filteredCourses = messageableCourses.filter((course) =>
    `${course.title} ${course.instructorName}`.toLocaleLowerCase().includes(normalizedSearch)
  );
  const activeConversation = thread?.conversation
    ?? conversations.find((conversation) => conversation.id === conversationId);
  const otherParticipant = activeConversation
    ? user.id === activeConversation.studentId
      ? activeConversation.instructorName
      : activeConversation.studentName
    : "Conversation";

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-7xl px-3 py-5 sm:px-6 sm:py-8">
        <h1 className="mb-5 flex items-center gap-2 text-2xl font-bold sm:text-3xl">
          Course messages <Badge variant="secondary">Beta</Badge>
        </h1>
        <div className="grid min-h-[min(72vh,48rem)] overflow-hidden rounded-xl border bg-card md:grid-cols-[18rem_minmax(0,1fr)]">
          <aside className={`${conversationId ? "hidden md:block" : ""} border-b md:border-b-0 md:border-r`}>
            <div className="space-y-4 border-b p-4">
              <div>
                <h2 className="font-semibold">Find an instructor</h2>
                <p className="mt-1 text-xs text-muted-foreground">Search courses by title or instructor name.</p>
              </div>
              {user.role === "student" && (
                <>
                  <label className="relative block">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="search"
                      value={courseSearch}
                      onChange={(event) => setCourseSearch(event.target.value)}
                      placeholder="Search courses or instructors"
                      aria-label="Search courses or instructors"
                      className="pl-9"
                    />
                  </label>
                  <div className="max-h-48 space-y-1 overflow-y-auto" aria-live="polite">
                    {coursesLoading ? (
                      <p className="p-2 text-sm text-muted-foreground">Loading courses...</p>
                    ) : coursesError ? (
                      <p className="p-2 text-sm text-destructive" role="alert">Courses could not be loaded.</p>
                    ) : filteredCourses.length === 0 ? (
                      <p className="p-2 text-sm text-muted-foreground">
                        {normalizedSearch ? "No matching courses or instructors." : "No courses with an available instructor yet."}
                      </p>
                    ) : filteredCourses.slice(0, 30).map((course) => (
                      <button
                        key={course.id}
                        type="button"
                        onClick={() => openCourseConversation.mutate(course.id)}
                        disabled={openCourseConversation.isPending}
                        className="flex w-full items-start gap-3 rounded-lg p-2 text-left hover:bg-accent disabled:opacity-50"
                      >
                        <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{course.title}</span>
                          <span className="block truncate text-xs text-muted-foreground">{course.instructorName}</span>
                        </span>
                      </button>
                    ))}
                    {filteredCourses.length > 30 && (
                      <p className="px-2 py-1 text-xs text-muted-foreground">Refine your search to see more results.</p>
                    )}
                  </div>
                </>
              )}
              <div className="border-t pt-3">
                <h2 className="font-semibold">Conversations</h2>
              </div>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-2">
              {conversationsLoading ? (
                <p className="p-3 text-sm text-muted-foreground">Loading conversations...</p>
              ) : conversationsError ? (
                <p className="p-3 text-sm text-destructive" role="alert">Conversations could not be loaded.</p>
              ) : conversations.length === 0 ? (
                <p className="p-3 text-sm text-muted-foreground">Choose a course above to start a conversation. Your chats will appear here.</p>
              ) : conversations.map((conversation) => {
                const participant = user.id === conversation.studentId
                  ? conversation.instructorName
                  : conversation.studentName;
                return (
                  <Link
                    key={conversation.id}
                    href={`/messages/${conversation.id}`}
                    className={`mb-1 block rounded-lg p-3 hover:bg-accent ${conversation.id === conversationId ? "bg-accent" : ""}`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">{conversation.courseTitle}</span>
                      {conversation.unreadCount > 0 && (
                        <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                          {conversation.unreadCount}
                        </span>
                      )}
                    </span>
                    <span className="mt-1 block truncate text-xs text-muted-foreground">{participant}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {new Date(conversation.updatedAt).toLocaleDateString()}
                    </span>
                  </Link>
                );
              })}
            </div>
          </aside>

          <section className={`${conversationId ? "flex" : "hidden md:flex"} min-w-0 flex-col`}>
            {conversationId ? (
              <>
                <header className="flex items-center gap-3 border-b p-4">
                  <Link href="/messages" className="md:hidden">
                    <Button variant="ghost" size="icon" aria-label="Back to conversations">
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                  </Link>
                  <div className="min-w-0">
                    <h2 className="truncate font-semibold">{activeConversation?.courseTitle || "Course conversation"}</h2>
                    <p className="truncate text-sm text-muted-foreground">{otherParticipant}</p>
                  </div>
                </header>
                {threadLoading ? (
                  <p className="m-auto p-6 text-sm text-muted-foreground">Loading messages...</p>
                ) : threadError ? (
                  <p className="m-auto p-6 text-sm text-destructive" role="alert">
                    This conversation could not be loaded. You may not have access to it.
                  </p>
                ) : (
                  <>
                    <div className="flex-1 space-y-3 overflow-y-auto p-4">
                      {thread?.messages.length ? thread.messages.map((message) => {
                        const isOwnMessage = message.senderId === user.id;
                        return (
                          <div key={message.id} className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}>
                            <article className={`max-w-[85%] rounded-2xl px-4 py-2 ${isOwnMessage ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                              {!isOwnMessage && <p className="mb-1 text-xs font-medium">{message.senderName}</p>}
                              <p className="whitespace-pre-wrap break-words text-sm">{message.body}</p>
                              <time className={`mt-1 block text-right text-[10px] ${isOwnMessage ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                                {new Date(message.createdAt).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
                              </time>
                            </article>
                          </div>
                        );
                      }) : (
                        <div className="flex h-full flex-col items-center justify-center py-16 text-center">
                          <MessageCircle className="mb-3 h-8 w-8 text-muted-foreground" />
                          <p className="font-medium">No messages yet</p>
                          <p className="mt-1 text-sm text-muted-foreground">Send a message to start the conversation.</p>
                        </div>
                      )}
                    </div>
                    <form onSubmit={handleSubmit} className="flex items-end gap-2 border-t p-3 sm:p-4">
                      <Textarea
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        placeholder="Write a message..."
                        aria-label="Message"
                        maxLength={4000}
                        rows={2}
                        className="max-h-40 min-h-11 resize-y"
                      />
                      <Button type="submit" size="icon" disabled={!draft.trim() || sendMessage.isPending} aria-label="Send message">
                        <Send className="h-4 w-4" />
                      </Button>
                    </form>
                  </>
                )}
              </>
            ) : (
              <div className="m-auto hidden max-w-sm p-8 text-center md:block">
                <MessageCircle className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                <h2 className="font-semibold">Your course inbox</h2>
                <p className="mt-2 text-sm text-muted-foreground">Search for a course or instructor, or choose one of your conversations.</p>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
