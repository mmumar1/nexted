import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { ArrowLeft, ArrowRight, Check, Clock3, RotateCcw, Send, X } from "lucide-react";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { apiRequest } from "@/lib/queryClient";
import type { CbtAttemptMode, CbtAttemptSelection, CbtAttemptStatus, CbtQuestionCatalogEntry } from "@shared/schema";

interface StudentQuestion {
  id: string;
  subject: string;
  examYear: number;
  question: string;
  questionImageUrl: string | null;
  options: string[];
  correctAnswer?: number;
  selectedOption?: number;
  explanation?: string | null;
  explanationImageUrl?: string | null;
}

interface StudentAttempt {
  id: string;
  mode: CbtAttemptMode;
  selections: CbtAttemptSelection[];
  durationMinutes: number;
  status: CbtAttemptStatus;
  score: number | null;
  totalQuestions: number;
  startedAt: string;
  expiresAt: string;
  serverNow: string;
  submittedAt: string | null;
  answers: Record<string, number>;
  questions: StudentQuestion[];
}

interface AttemptHistoryEntry {
  id: string;
  mode: CbtAttemptMode;
  selections: CbtAttemptSelection[];
  durationMinutes: number;
  status: CbtAttemptStatus;
  score: number | null;
  totalQuestions: number;
  startedAt: string;
  expiresAt: string;
  submittedAt: string | null;
}

const durationOptions = [15, 30, 45, 60, 90, 120];

function standardMockCount(subject: string): number {
  return /^english(?:\b|$)/i.test(subject) ? 60 : 40;
}

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return [hours, minutes, remainder].map((part) => String(part).padStart(2, "0")).join(":");
}

function durationLabel(startedAt: string, submittedAt: string | null): { seconds: number; label: string } {
  const start = new Date(startedAt).getTime();
  const end = submittedAt ? new Date(submittedAt).getTime() : Date.now();
  const seconds = Math.max(0, Math.floor((end - start) / 1000));
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return {
    seconds,
    label: `${minutes}m ${String(remainingSeconds).padStart(2, "0")}s`,
  };
}

export default function Cbt() {
  const [, params] = useRoute("/cbt/attempt/:attemptId");
  const attemptId = params?.attemptId;
  const [, setLocation] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<CbtAttemptMode>("self");
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [subject, setSubject] = useState("");
  const [examYear, setExamYear] = useState("");
  const [questionCount, setQuestionCount] = useState("10");
  const [selections, setSelections] = useState<CbtAttemptSelection[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [timerAttemptId, setTimerAttemptId] = useState<string | null>(null);
  const [localAnswers, setLocalAnswers] = useState<Record<string, number>>({});
  const autoSubmittedAttemptId = useRef<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) setLocation("/login");
  }, [isAuthenticated, setLocation]);

  const catalogQuery = useQuery<CbtQuestionCatalogEntry[]>({
    queryKey: ["/api/cbt/catalog", user?.id],
    queryFn: () => apiRequest("GET", "/api/cbt/catalog"),
    enabled: !!user?.id && user.role === "student" && !attemptId,
  });
  const activeAttemptQuery = useQuery<StudentAttempt | null>({
    queryKey: ["/api/cbt/attempts/active", user?.id],
    queryFn: () => apiRequest("GET", "/api/cbt/attempts/active"),
    enabled: !!user?.id && user.role === "student" && !attemptId,
  });
  const historyQuery = useQuery<AttemptHistoryEntry[]>({
    queryKey: ["/api/cbt/attempts", user?.id],
    queryFn: () => apiRequest("GET", "/api/cbt/attempts"),
    enabled: !!user?.id && user.role === "student" && !attemptId,
  });
  const attemptQuery = useQuery<StudentAttempt>({
    queryKey: ["/api/cbt/attempts", attemptId],
    queryFn: () => apiRequest("GET", `/api/cbt/attempts/${attemptId}`),
    enabled: !!user?.id && user.role === "student" && !!attemptId,
    refetchInterval: (query) => query.state.data?.status === "in_progress" ? 15_000 : false,
  });

  const catalog = catalogQuery.data ?? [];
  const subjects = useMemo(
    () => Array.from(new Set(catalog.map((entry) => entry.subject))).sort((a, b) => a.localeCompare(b)),
    [catalog],
  );
  const years = catalog.filter((entry) => entry.subject === subject).map((entry) => entry.examYear).sort((a, b) => b - a);
  const selectedCatalogEntry = catalog.find((entry) => entry.subject === subject && entry.examYear === Number(examYear));
  const activeAttempt = activeAttemptQuery.data?.status === "in_progress" ? activeAttemptQuery.data : null;
  const attempt = attemptQuery.data;
  const selectionsAvailable = selections.every((selection) =>
    selection.questionCount <= (catalog.find((entry) =>
      entry.subject === selection.subject && entry.examYear === selection.examYear,
    )?.count ?? 0),
  );

  useEffect(() => {
    if (!subjects.length) return;
    if (!subject || !subjects.includes(subject)) setSubject(subjects[0]);
  }, [subjects, subject]);

  useEffect(() => {
    if (!years.length) {
      setExamYear("");
      return;
    }
    if (!years.includes(Number(examYear))) setExamYear(String(years[0]));
  }, [years, examYear]);

  useEffect(() => {
    if (mode === "mock") setDurationMinutes(120);
    else if (durationMinutes === 120) setDurationMinutes(30);
  }, [mode]);

  useEffect(() => {
    if (attempt) {
      setLocalAnswers(attempt.answers);
      setCurrentQuestionIndex((index) => Math.min(index, Math.max(attempt.questions.length - 1, 0)));
    }
  }, [attempt?.id, attempt?.answers, attempt?.questions.length]);

  const invalidateCbtQueries = () => {
    void queryClient.invalidateQueries({ queryKey: ["/api/cbt/attempts", user?.id] });
    void queryClient.invalidateQueries({ queryKey: ["/api/cbt/attempts/active", user?.id] });
  };

  const startAttempt = useMutation({
    mutationFn: () => apiRequest("POST", "/api/cbt/attempts", {
      mode,
      durationMinutes: mode === "mock" ? 120 : durationMinutes,
      selections,
    }),
    onSuccess: (created: StudentAttempt) => {
      setLocalAnswers(created.answers);
      setCurrentQuestionIndex(0);
      autoSubmittedAttemptId.current = null;
      setLocation(`/cbt/attempt/${created.id}`);
      invalidateCbtQueries();
    },
    onError: (error: Error) => toast({
      title: "Could not start the test",
      description: error.message,
      variant: "destructive",
    }),
  });

  const saveAnswer = useMutation({
    mutationFn: ({ questionId, selectedOption }: { questionId: string; selectedOption: number | null }) =>
      apiRequest("PATCH", `/api/cbt/attempts/${attemptId}/answers`, { questionId, selectedOption }),
    onSuccess: (_result: { questionId: string; selectedOption: number | null }, variables) => {
      setLocalAnswers((current) => {
        const updated = { ...current };
        if (variables.selectedOption === null) delete updated[variables.questionId];
        else updated[variables.questionId] = variables.selectedOption;
        return updated;
      });
      queryClient.setQueryData<StudentAttempt>(["/api/cbt/attempts", attemptId], (current) => {
        if (!current) return current;
        const answers = { ...current.answers };
        if (variables.selectedOption === null) delete answers[variables.questionId];
        else answers[variables.questionId] = variables.selectedOption;
        return { ...current, answers };
      });
    },
    onError: (error: Error) => {
      toast({ title: "Answer could not be saved", description: error.message, variant: "destructive" });
      void attemptQuery.refetch();
    },
  });

  const submitAttempt = useMutation({
    mutationFn: () => apiRequest("POST", `/api/cbt/attempts/${attemptId}/submit`),
    onSuccess: (finished: StudentAttempt) => {
      queryClient.setQueryData(["/api/cbt/attempts", attemptId], finished);
      setLocalAnswers(finished.answers);
      invalidateCbtQueries();
    },
    onError: (error: Error) => toast({
      title: "Could not submit the test",
      description: error.message,
      variant: "destructive",
    }),
  });

  useEffect(() => {
    if (!attempt || attempt.status !== "in_progress") return;
    const remainingAtSync = Math.max(
      0,
      new Date(attempt.expiresAt).getTime() - new Date(attempt.serverNow).getTime(),
    );
    const deadline = performance.now() + remainingAtSync;
    const updateRemaining = () => {
      setRemainingSeconds(Math.max(0, Math.ceil((deadline - performance.now()) / 1000)));
    };
    setTimerAttemptId(attempt.id);
    updateRemaining();
    const timer = window.setInterval(updateRemaining, 1000);
    return () => window.clearInterval(timer);
  }, [attempt?.id, attempt?.status, attempt?.expiresAt, attempt?.serverNow]);

  useEffect(() => {
    if (
      attempt?.status === "in_progress"
      && remainingSeconds === 0
      && timerAttemptId === attempt.id
      && autoSubmittedAttemptId.current !== attempt.id
      && !submitAttempt.isPending
    ) {
      autoSubmittedAttemptId.current = attempt.id;
      submitAttempt.mutate();
    }
  }, [attempt?.id, attempt?.status, remainingSeconds, timerAttemptId, submitAttempt.isPending]);

  useEffect(() => {
    if (attempt && attempt.status !== "in_progress") {
      invalidateCbtQueries();
    }
  }, [attempt?.id, attempt?.status]);

  if (!isAuthenticated) return null;

  if (user?.role !== "student") {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
          <Card>
            <CardHeader>
              <CardTitle>Student CBT practice</CardTitle>
              <CardDescription>CBT test attempts are available to student accounts.</CardDescription>
            </CardHeader>
            <CardContent><Button onClick={() => setLocation("/dashboard")}>Back to dashboard</Button></CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const addSelection = () => {
    if (!selectedCatalogEntry) return;
    const count = mode === "mock" ? standardMockCount(subject) : Number(questionCount);
    if (!Number.isInteger(count) || count < 1) {
      toast({ title: "Choose at least one question", variant: "destructive" });
      return;
    }
    if (count > 200) {
      toast({ title: "A self-test can contain up to 200 questions per subject", variant: "destructive" });
      return;
    }
    if (selections.some((selection) => selection.subject === subject && selection.examYear === Number(examYear))) {
      toast({ title: "That subject and year are already selected", variant: "destructive" });
      return;
    }
    if (count > selectedCatalogEntry.count) {
      toast({
        title: "Not enough published questions",
        description: `There are ${selectedCatalogEntry.count} available for this subject and year.`,
        variant: "destructive",
      });
      return;
    }
    if (selections.reduce((total, selection) => total + selection.questionCount, 0) + count > 500) {
      toast({ title: "A test cannot contain more than 500 questions", variant: "destructive" });
      return;
    }
    setSelections((current) => [...current, {
      subject,
      examYear: Number(examYear),
      questionCount: count,
    }]);
  };

  const submitManually = () => {
    if (!attempt || attempt.status !== "in_progress" || submitAttempt.isPending) return;
    const unanswered = attempt.questions.length - Object.keys(localAnswers).length;
    if (unanswered > 0 && !window.confirm(`You have ${unanswered} unanswered question${unanswered === 1 ? "" : "s"}. Submit anyway?`)) {
      return;
    }
    submitAttempt.mutate();
  };

  const setAnswer = (questionId: string, selectedOption: number | null) => {
    setLocalAnswers((current) => {
      const updated = { ...current };
      if (selectedOption === null) delete updated[questionId];
      else updated[questionId] = selectedOption;
      return updated;
    });
    saveAnswer.mutate({ questionId, selectedOption });
  };

  const onAttemptRoute = !!attemptId;
  const backButton = (
    <Button variant="ghost" className="mb-5" onClick={() => setLocation("/cbt")}>
      <ArrowLeft className="mr-2 h-4 w-4" />Back to CBT practice
    </Button>
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
        {onAttemptRoute && backButton}
        {!onAttemptRoute ? (
          <>
            <header>
              <p className="text-sm font-medium text-primary">Practice at your pace</p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight">CBT practice</h1>
              <p className="mt-2 text-muted-foreground">Build a self-test from published questions or take a standard mock test.</p>
            </header>

            {activeAttempt && (
              <Card className="border-primary/40">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Clock3 className="h-5 w-5 text-primary" />You have a test in progress</CardTitle>
                  <CardDescription>
                    {activeAttempt.totalQuestions} questions · {activeAttempt.mode === "mock" ? "Mock test" : "Self-test"} · Started {new Date(activeAttempt.startedAt).toLocaleString()}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button onClick={() => setLocation(`/cbt/attempt/${activeAttempt.id}`)}>Resume test</Button>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Create a test</CardTitle>
                <CardDescription>Choose subjects and a year. Answers are saved automatically and the timer is enforced by the server.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setMode("self")}
                    className={`rounded-lg border p-4 text-left transition-colors ${mode === "self" ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
                    aria-pressed={mode === "self"}
                  >
                    <span className="block font-semibold">Self-test</span>
                    <span className="mt-1 block text-sm text-muted-foreground">Choose the number of questions and duration.</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode("mock");
                      setSelections((current) => current.map((selection) => ({
                        ...selection,
                        questionCount: standardMockCount(selection.subject),
                      })));
                    }}
                    className={`rounded-lg border p-4 text-left transition-colors ${mode === "mock" ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
                    aria-pressed={mode === "mock"}
                  >
                    <span className="block font-semibold">Standard mock</span>
                    <span className="mt-1 block text-sm text-muted-foreground">60 English questions, 40 per other subject, 120 minutes.</span>
                  </button>
                </div>

                {catalogQuery.isPending && <p className="text-sm text-muted-foreground">Loading available subjects...</p>}
                {catalogQuery.isError && <p role="alert" className="text-sm text-destructive">Could not load the CBT question bank. Refresh to try again.</p>}
                {!catalogQuery.isPending && !catalogQuery.isError && catalog.length === 0 && (
                  <div className="rounded-lg border border-dashed p-6 text-center">
                    <p className="font-medium">No published questions are available yet.</p>
                    <p className="mt-1 text-sm text-muted-foreground">Your instructor will publish questions here when they are ready.</p>
                  </div>
                )}

                {catalog.length > 0 && (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="space-y-2">
                        <Label htmlFor="cbt-subject">Subject</Label>
                        <select id="cbt-subject" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={subject} onChange={(event) => setSubject(event.target.value)}>
                          {subjects.map((item) => <option key={item} value={item}>{item}</option>)}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cbt-year">Exam year</Label>
                        <select id="cbt-year" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={examYear} onChange={(event) => setExamYear(event.target.value)}>
                          {years.map((year) => <option key={year} value={year}>{year}</option>)}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cbt-question-count">Questions</Label>
                        {mode === "mock" ? (
                          <div id="cbt-question-count" className="flex h-10 items-center rounded-md border bg-muted/30 px-3 text-sm">
                            {standardMockCount(subject)} standard questions
                          </div>
                        ) : (
                          <Input
                            id="cbt-question-count"
                            type="number"
                            min={1}
                            max={Math.min(selectedCatalogEntry?.count ?? 200, 200)}
                            value={questionCount}
                            onChange={(event) => setQuestionCount(event.target.value)}
                          />
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cbt-duration">Duration</Label>
                        {mode === "mock" ? (
                          <div id="cbt-duration" className="flex h-10 items-center rounded-md border bg-muted/30 px-3 text-sm">120 minutes</div>
                        ) : (
                          <select id="cbt-duration" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={durationMinutes} onChange={(event) => setDurationMinutes(Number(event.target.value))}>
                            {durationOptions.map((minutes) => <option key={minutes} value={minutes}>{minutes} minutes</option>)}
                          </select>
                        )}
                      </div>
                    </div>

                    {selectedCatalogEntry && (
                      <p className="text-sm text-muted-foreground">
                        {selectedCatalogEntry.count} published question{selectedCatalogEntry.count === 1 ? "" : "s"} available for {subject}, {examYear}.
                      </p>
                    )}
                    <Button type="button" variant="outline" onClick={addSelection} disabled={!selectedCatalogEntry}>
                      Add subject
                    </Button>

                    <div className="space-y-2">
                      <h2 className="font-semibold">Selected subjects</h2>
                      {selections.length === 0 ? (
                        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Add at least one subject to continue.</p>
                      ) : (
                        <ul className="space-y-2">
                          {selections.map((selection) => (
                            <li key={`${selection.subject}-${selection.examYear}`} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                              <span className="font-medium">{selection.subject} · {selection.examYear}</span>
                              <span className="text-sm text-muted-foreground">{selection.questionCount} questions</span>
                              <Button type="button" variant="ghost" size="sm" onClick={() => setSelections((current) => current.filter((item) => item !== selection))}>Remove</Button>
                            </li>
                          ))}
                        </ul>
                      )}
                      {selections.length > 0 && !selectionsAvailable && (
                        <p role="alert" className="text-sm text-destructive">
                          The published question bank does not yet have enough questions for the selected mock standard.
                        </p>
                      )}
                    </div>

                    <Button
                      type="button"
                      onClick={() => startAttempt.mutate()}
                      disabled={selections.length === 0 || !selectionsAvailable || startAttempt.isPending || !!activeAttempt}
                    >
                      {startAttempt.isPending ? "Preparing test..." : "Start test"}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><RotateCcw className="h-5 w-5" />Recent tests</CardTitle>
                <CardDescription>Review a completed test or return to an active attempt.</CardDescription>
              </CardHeader>
              <CardContent>
                {historyQuery.isPending && <p className="text-sm text-muted-foreground">Loading your test history...</p>}
                {historyQuery.isError && <p role="alert" className="text-sm text-destructive">Could not load your test history.</p>}
                {!historyQuery.isPending && !historyQuery.isError && !(historyQuery.data?.length) && (
                  <p className="text-sm text-muted-foreground">Your completed tests will appear here.</p>
                )}
                <ul className="space-y-2">
                  {historyQuery.data?.map((entry) => (
                    <li key={entry.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                      <div>
                        <p className="font-medium">{entry.mode === "mock" ? "Standard mock" : "Self-test"} · {entry.totalQuestions} questions</p>
                        <p className="text-sm text-muted-foreground">
                          {entry.selections.map((item) => `${item.subject} ${item.examYear}`).join(" · ")} · {new Date(entry.startedAt).toLocaleString()}
                        </p>
                        {entry.status !== "in_progress" && <p className="mt-1 text-sm">Score: {entry.score ?? 0}/{entry.totalQuestions}</p>}
                      </div>
                      <Button type="button" variant="outline" size="sm" onClick={() => setLocation(`/cbt/attempt/${entry.id}`)}>
                        {entry.status === "in_progress" ? "Resume" : "Review"}
                      </Button>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </>
        ) : (
          <AttemptView
            attempt={attempt}
            isLoading={attemptQuery.isPending}
            isError={attemptQuery.isError}
            currentQuestionIndex={currentQuestionIndex}
            setCurrentQuestionIndex={setCurrentQuestionIndex}
            answers={localAnswers}
            remainingSeconds={remainingSeconds}
            isSaving={saveAnswer.isPending}
            isSubmitting={submitAttempt.isPending}
            onAnswer={setAnswer}
            onSubmit={submitManually}
            onRetry={() => void attemptQuery.refetch()}
          />
        )}
      </main>
    </div>
  );
}

function AttemptView({
  attempt,
  isLoading,
  isError,
  currentQuestionIndex,
  setCurrentQuestionIndex,
  answers,
  remainingSeconds,
  isSaving,
  isSubmitting,
  onAnswer,
  onSubmit,
  onRetry,
}: {
  attempt?: StudentAttempt;
  isLoading: boolean;
  isError: boolean;
  currentQuestionIndex: number;
  setCurrentQuestionIndex: (index: number) => void;
  answers: Record<string, number>;
  remainingSeconds: number | null;
  isSaving: boolean;
  isSubmitting: boolean;
  onAnswer: (questionId: string, selectedOption: number | null) => void;
  onSubmit: () => void;
  onRetry: () => void;
}) {
  if (isLoading) return <Card><CardContent className="py-10 text-center text-muted-foreground">Loading your test...</CardContent></Card>;
  if (isError || !attempt) {
    return (
      <Card>
        <CardHeader><CardTitle>Could not open this test</CardTitle><CardDescription>The attempt may not exist or may belong to another account.</CardDescription></CardHeader>
        <CardContent><Button variant="outline" onClick={onRetry}>Try again</Button></CardContent>
      </Card>
    );
  }

  if (attempt.status !== "in_progress") {
    const elapsed = durationLabel(
      attempt.startedAt,
      attempt.status === "expired" ? attempt.expiresAt : attempt.submittedAt,
    );
    const score = attempt.score ?? 0;
    const percentage = attempt.totalQuestions ? Math.round((score / attempt.totalQuestions) * 100) : 0;
    const secondsPerQuestion = attempt.totalQuestions ? Math.round(elapsed.seconds / attempt.totalQuestions) : 0;
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{attempt.status === "expired" ? "Time is up" : "Test submitted"}</CardTitle>
            <CardDescription>
              {attempt.mode === "mock" ? "Standard mock test" : "Self-test"} · {attempt.selections.map((item) => `${item.subject} ${item.examYear}`).join(" · ")}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg bg-muted/40 p-4">
              <p className="text-sm text-muted-foreground">Score</p>
              <p className="mt-1 text-2xl font-bold">{score}/{attempt.totalQuestions}</p>
              <p className="text-sm text-muted-foreground">{percentage}% correct</p>
            </div>
            <div className="rounded-lg bg-muted/40 p-4">
              <p className="text-sm text-muted-foreground">Time used</p>
              <p className="mt-1 text-2xl font-bold">{elapsed.label}</p>
            </div>
            <div className="rounded-lg bg-muted/40 p-4">
              <p className="text-sm text-muted-foreground">Average speed</p>
              <p className="mt-1 text-2xl font-bold">{secondsPerQuestion}s</p>
              <p className="text-sm text-muted-foreground">per question</p>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Answer review</h2>
          <p className="text-sm text-muted-foreground">One point per correct answer. Wrong and unanswered questions have no penalty.</p>
        </div>
        <div className="space-y-4">
          {attempt.questions.map((question, index) => {
            const chosen = question.selectedOption;
            return (
              <Card key={question.id}>
                <CardHeader>
                  <CardDescription>Question {index + 1} · {question.subject} · {question.examYear}</CardDescription>
                  <CardTitle className="text-lg font-medium">{question.question}</CardTitle>
                  {question.questionImageUrl && <img src={question.questionImageUrl} alt={`Question ${index + 1}`} className="max-h-80 max-w-full rounded-md object-contain" />}
                </CardHeader>
                <CardContent className="space-y-2">
                  {question.options.map((option, optionIndex) => {
                    const number = optionIndex + 1;
                    const isCorrect = number === question.correctAnswer;
                    const isChosen = number === chosen;
                    return (
                      <div
                        key={`${question.id}-${number}`}
                        className={`flex items-start gap-3 rounded-md border p-3 text-sm ${isCorrect ? "border-emerald-600 bg-emerald-500/10" : isChosen ? "border-destructive bg-destructive/5" : ""}`}
                      >
                        {isCorrect ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : isChosen ? <X className="mt-0.5 h-4 w-4 shrink-0 text-destructive" /> : <span className="w-4 shrink-0 text-muted-foreground">{String.fromCharCode(64 + number)}.</span>}
                        <span className="flex-1">{option}</span>
                        {isChosen && <span className="text-xs text-muted-foreground">Your answer</span>}
                        {isCorrect && <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Correct answer</span>}
                      </div>
                    );
                  })}
                  {chosen === undefined && <p className="text-sm text-muted-foreground">No answer selected.</p>}
                  {question.explanation && <div className="rounded-md bg-muted/40 p-3 text-sm"><span className="font-medium">Explanation: </span>{question.explanation}</div>}
                  {question.explanationImageUrl && <img src={question.explanationImageUrl} alt={`Explanation for question ${index + 1}`} className="max-h-80 max-w-full rounded-md object-contain" />}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  const question = attempt.questions[currentQuestionIndex];
  if (!question) return <Card><CardContent className="py-10 text-center">No questions were included in this attempt.</CardContent></Card>;
  const answeredCount = Object.keys(answers).length;

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
          <div>
            <p className="font-semibold">{attempt.mode === "mock" ? "Standard mock" : "Self-test"}</p>
            <p className="text-sm text-muted-foreground">{attempt.selections.map((item) => `${item.subject} ${item.examYear}`).join(" · ")}</p>
          </div>
          <div className={`flex items-center gap-2 rounded-md px-3 py-2 font-mono text-lg font-bold ${remainingSeconds !== null && remainingSeconds <= 60 ? "bg-destructive/10 text-destructive" : "bg-muted/50"}`} role="timer" aria-live="off">
            <Clock3 className="h-5 w-5" />{formatTime(remainingSeconds ?? 0)}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_250px]">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardDescription>Question {currentQuestionIndex + 1} of {attempt.totalQuestions} · {question.subject} · {question.examYear}</CardDescription>
              <CardDescription>{answeredCount}/{attempt.totalQuestions} answered{isSaving ? " · Saving..." : ""}</CardDescription>
            </div>
            <CardTitle className="text-xl font-semibold leading-relaxed">{question.question}</CardTitle>
            {question.questionImageUrl && <img src={question.questionImageUrl} alt={`Question ${currentQuestionIndex + 1}`} className="max-h-96 max-w-full rounded-md object-contain" />}
          </CardHeader>
          <CardContent className="space-y-3">
            {question.options.map((option, index) => {
              const number = index + 1;
              const selected = answers[question.id] === number;
              return (
                <button
                  type="button"
                  key={`${question.id}-${number}`}
                  onClick={() => onAnswer(question.id, number)}
                  aria-pressed={selected}
                  disabled={isSaving}
                  className={`flex w-full items-start gap-3 rounded-lg border p-4 text-left transition-colors hover:bg-muted/40 ${selected ? "border-primary bg-primary/5" : ""}`}
                >
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${selected ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                    {String.fromCharCode(64 + number)}
                  </span>
                  <span className="whitespace-pre-wrap">{option}</span>
                </button>
              );
            })}
            <div className="flex flex-wrap justify-between gap-2 pt-3">
              <Button variant="outline" onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))} disabled={currentQuestionIndex === 0}>
                <ArrowLeft className="mr-2 h-4 w-4" />Previous
              </Button>
              {currentQuestionIndex < attempt.totalQuestions - 1 ? (
                <Button onClick={() => setCurrentQuestionIndex(currentQuestionIndex + 1)}>
                  Next<ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={onSubmit} disabled={isSubmitting || isSaving}>
                  <Send className="mr-2 h-4 w-4" />{isSubmitting ? "Submitting..." : "Submit test"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Question navigator</CardTitle>
            <CardDescription>Select a number to jump to a question.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-5 gap-2">
              {attempt.questions.map((item, index) => {
                const answered = answers[item.id] !== undefined;
                return (
                  <Button
                    key={item.id}
                    type="button"
                    variant={index === currentQuestionIndex ? "default" : answered ? "secondary" : "outline"}
                    size="sm"
                    aria-label={`Question ${index + 1}${answered ? ", answered" : ", unanswered"}`}
                    aria-current={index === currentQuestionIndex ? "step" : undefined}
                    className="px-0"
                    onClick={() => setCurrentQuestionIndex(index)}
                  >
                    {index + 1}
                  </Button>
                );
              })}
            </div>
            <div className="space-y-1 text-xs text-muted-foreground">
              <p>{answeredCount} answered · {attempt.totalQuestions - answeredCount} unanswered</p>
              <p>Answers save automatically and are restored if you return to this test.</p>
            </div>
            <Button className="w-full" variant="outline" onClick={onSubmit} disabled={isSubmitting || isSaving}>
              {isSubmitting ? "Submitting..." : "Submit test"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
