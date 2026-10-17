import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Navbar } from "@/components/navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Check, ChevronLeft, Download, Share2, Trophy, X } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { compareModuleOrder } from "@/lib/module-utils";
import { QuizMarkdownContent } from "@/components/quiz/quiz-markdown";
import { useToast } from "@/hooks/use-toast";
import type { Module, QuizQuestion } from "@shared/schema";

interface QuizData {
  id: string;
  moduleId: string;
  title: string;
  passScore: number;
  questions: QuizQuestion[];
}

interface AchievementCardData {
  studentName: string;
  quizTitle: string;
  percentage: number;
  passed: boolean;
}

function roundedRectPath(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

function wrapCanvasText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
) {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let line = "";

  words.forEach((word) => {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width <= maxWidth || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  });
  if (line) lines.push(line);

  const visibleLines = lines.slice(0, maxLines);
  if (lines.length > maxLines) {
    let lastLine = visibleLines[maxLines - 1];
    while (lastLine && context.measureText(`${lastLine}...`).width > maxWidth) {
      lastLine = lastLine.slice(0, -1);
    }
    visibleLines[maxLines - 1] = `${lastLine.trimEnd()}...`;
  }

  visibleLines.forEach((visibleLine, index) => context.fillText(visibleLine, x, y + index * lineHeight));
}

function createAchievementImage({ studentName, quizTitle, percentage, passed }: AchievementCardData) {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Your browser could not prepare the achievement image.");

  const background = context.createLinearGradient(0, 0, 1080, 1350);
  background.addColorStop(0, "#073b3a");
  background.addColorStop(0.52, "#087f78");
  background.addColorStop(1, "#102c45");
  context.fillStyle = background;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.fillStyle = "rgba(255, 255, 255, 0.06)";
  context.beginPath();
  context.arc(960, 100, 350, 0, Math.PI * 2);
  context.fill();
  context.beginPath();
  context.arc(80, 1120, 310, 0, Math.PI * 2);
  context.fill();

  roundedRectPath(context, 64, 64, 952, 1222, 44);
  context.strokeStyle = "rgba(255, 255, 255, 0.24)";
  context.lineWidth = 2;
  context.stroke();

  context.textAlign = "center";
  context.fillStyle = "#ffffff";
  context.font = "700 34px Inter, Arial, sans-serif";
  context.fillText("LEARNPEDIA", 540, 155);
  context.fillStyle = "#fbbf24";
  context.font = "600 19px Inter, Arial, sans-serif";
  context.letterSpacing = "5px";
  context.fillText("LEARNING WITHOUT LIMITS", 540, 198);
  context.letterSpacing = "0px";

  context.save();
  context.translate(112, 700);
  context.rotate(-Math.PI / 2);
  context.fillStyle = "rgba(255, 255, 255, 0.78)";
  context.font = "600 22px Inter, Arial, sans-serif";
  context.letterSpacing = "2px";
  context.fillText("learnpedia.app", 0, 0);
  context.restore();

  context.save();
  context.translate(968, 700);
  context.rotate(Math.PI / 2);
  context.fillStyle = "rgba(255, 255, 255, 0.78)";
  context.font = "600 22px Inter, Arial, sans-serif";
  context.letterSpacing = "2px";
  context.fillText("learnpedia.app", 0, 0);
  context.restore();

  context.fillStyle = "#fbbf24";
  context.beginPath();
  context.arc(540, 310, 68, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "rgba(255, 255, 255, 0.9)";
  context.lineWidth = 7;
  context.beginPath();
  context.moveTo(512, 361);
  context.lineTo(496, 411);
  context.lineTo(535, 393);
  context.closePath();
  context.fill();
  context.beginPath();
  context.moveTo(568, 361);
  context.lineTo(584, 411);
  context.lineTo(545, 393);
  context.closePath();
  context.fill();
  context.fillStyle = "#073b3a";
  context.font = "700 54px Arial, sans-serif";
  context.fillText("★", 540, 328);

  context.fillStyle = "#ffffff";
  context.font = "800 88px Inter, Arial, sans-serif";
  context.fillText("LEVEL UP!", 540, 510);
  context.fillStyle = "rgba(255, 255, 255, 0.78)";
  context.font = "500 30px Inter, Arial, sans-serif";
  context.fillText(passed ? "Another milestone unlocked" : "Every try moves you forward", 540, 562);

  context.fillStyle = "#fbbf24";
  context.font = "800 240px Inter, Arial, sans-serif";
  context.fillText(`${percentage}%`, 540, 835);
  context.fillStyle = "rgba(255, 255, 255, 0.78)";
  context.font = "600 28px Inter, Arial, sans-serif";
  context.fillText("QUIZ SCORE", 540, 890);

  context.fillStyle = "rgba(255, 255, 255, 0.14)";
  roundedRectPath(context, 154, 948, 772, 156, 24);
  context.fill();
  context.fillStyle = "#fbbf24";
  context.font = "600 18px Inter, Arial, sans-serif";
  context.fillText("ACHIEVEMENT EARNED BY", 540, 990);
  context.fillStyle = "#ffffff";
  context.font = "700 36px Inter, Arial, sans-serif";
  context.fillText(studentName, 540, 1044);
  context.fillStyle = "rgba(255, 255, 255, 0.76)";
  context.font = "500 22px Inter, Arial, sans-serif";
  wrapCanvasText(context, quizTitle, 540, 1130, 800, 32, 2);

  context.fillStyle = "#fbbf24";
  context.fillRect(420, 1210, 240, 4);
  context.fillStyle = "#ffffff";
  context.font = "600 26px Inter, Arial, sans-serif";
  context.fillText("learnpedia.app", 540, 1255);

  return canvas;
}

export default function Quiz() {
  const [, params] = useRoute("/quiz/:moduleId");
  const [, setLocation] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const moduleId = params?.moduleId || "1";

  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [showResults, setShowResults] = useState(false);
  const [score, setScore] = useState(0);
  const [isSharing, setIsSharing] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setLocation("/login");
    }
  }, [isAuthenticated, setLocation]);

  const { data: quiz, isLoading, error: quizError } = useQuery<QuizData>({
    queryKey: ["/api/quizzes/module", moduleId],
    enabled: !!moduleId,
  });
  const percentage = quiz?.questions.length
    ? Math.round((score / quiz.questions.length) * 100)
    : 0;

  const { data: module } = useQuery<Module>({
    queryKey: ["/api/modules", moduleId],
    enabled: !!moduleId,
  });

  const { data: courseModules } = useQuery<Module[]>({
    queryKey: ["/api/modules/course", module?.courseId || "1"],
    enabled: !!module?.courseId,
  });

  const submitQuizMutation = useMutation({
    mutationFn: async (data: { quizId: string; score: number; totalQuestions: number }) => {
      return apiRequest("POST", "/api/quiz-attempts", {
        userId: user?.id,
        ...data,
      });
    },
    onSuccess: async (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/quiz-progress", user?.id, (module as Module | undefined)?.courseId] });
      const passed = (variables.score / variables.totalQuestions) * 100 >= (quiz?.passScore ?? 70);
      if (passed && moduleId) {
        await apiRequest("POST", "/api/module-completions", {
          userId: user?.id,
          moduleId,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/module-completions", user?.id, (module as Module | undefined)?.courseId] });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard", user?.id] });
      }
    },
  });

  if (!user) return null;

  const handleAnswerSelect = (questionId: string, answerIndex: number) => {
    setAnswers({
      ...answers,
      [questionId]: answerIndex,
    });
  };

  const handleSubmit = () => {
    if (!quiz) return;
    
    let correctCount = 0;
    quiz.questions.forEach((q) => {
      if (answers[q.id] === q.correctAnswer) {
        correctCount++;
      }
    });
    
    setScore(correctCount);
    setShowResults(true);
    
    // Save quiz attempt
    submitQuizMutation.mutate({
      quizId: quiz.id,
      score: correctCount,
      totalQuestions: quiz.questions.length,
    });
  };

  const handleRetry = () => {
    setAnswers({});
    setCurrentQuestion(0);
    setShowResults(false);
    setScore(0);
  };

  const achievementData: AchievementCardData = {
    studentName: user.fullName,
    quizTitle: quiz?.title || "Quiz",
    percentage,
    passed: percentage >= (quiz?.passScore ?? 70),
  };

  const exportAchievement = async (share: boolean) => {
    setIsSharing(true);
    try {
      const canvas = createAchievementImage(achievementData);
      const image = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error("The achievement image could not be generated."));
        }, "image/png");
      });

      const safeTitle = achievementData.quizTitle
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "quiz";
      const filename = `learnpedia-level-up-${safeTitle}.png`;

      if (share && typeof navigator.share === "function") {
        const file = new File([image], filename, { type: "image/png" });
        if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: `${achievementData.studentName} leveled up on Learnpedia`,
            text: `I scored ${percentage}% on ${achievementData.quizTitle}. Level up with me!`,
            files: [file],
          });
          return;
        }
      }

      const imageUrl = URL.createObjectURL(image);
      const downloadLink = document.createElement("a");
      downloadLink.href = imageUrl;
      downloadLink.download = filename;
      downloadLink.click();
      window.setTimeout(() => URL.revokeObjectURL(imageUrl), 1000);
      if (share) {
        toast({
          title: "Image downloaded",
          description: "Image sharing is not available in this browser, so the achievement card was downloaded instead.",
        });
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast({
        title: "Could not export achievement",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSharing(false);
    }
  };

  const handleBackToCourse = () => {
    setLocation(`/course/${module?.courseId || "1"}/module/${moduleId}`);
  };

  const handleNextModule = () => {
    const courseId = module?.courseId || "1";
    if (!courseModules || !module) {
      setLocation(`/course/${courseId}`);
      return;
    }

    const orderedModules = [...courseModules].sort((a, b) => compareModuleOrder(a, b, courseModules));
    const currentIndex = orderedModules.findIndex((item) => item.id === moduleId);
    const nextModule = currentIndex >= 0 ? orderedModules[currentIndex + 1] : undefined;

    if (nextModule) {
      setLocation(`/course/${courseId}/module/${nextModule.id}`);
      return;
    }

    setLocation(`/course/${courseId}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Skeleton className="h-8 w-32 mb-6" />
          <Skeleton className="h-10 w-2/3 mb-8" />
          <Card className="border-card-border">
            <CardHeader>
              <Skeleton className="h-6 w-full mb-2" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (quizError || !quiz || quiz.questions.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <p className="text-destructive">
                {quizError instanceof Error
                  ? quizError.message
                  : quiz
                    ? "This quiz does not have any questions yet."
                    : "A quiz for this module could not be found."}
              </p>
              <Button variant="secondary" onClick={handleBackToCourse}>Back to course</Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const currentQ = quiz.questions[currentQuestion];
  const selectedAnswer = answers[currentQ.id];
  const totalQuestions = quiz.questions.length;
  const answeredCount = Object.keys(answers).length;
  const canSubmit = answeredCount === totalQuestions;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <Link href={`/course/${(module as any)?.courseId || "1"}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 hover-elevate px-2 py-1 rounded-md" data-testid="link-back-course">
          <ChevronLeft className="w-4 h-4" />
          Back to Course
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {quiz.title}
          </h1>
          <p className="text-muted-foreground">
            Test your knowledge of the module content
          </p>
        </div>

        {/* Progress Indicator */}
        <div className="mb-6">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-muted-foreground">
              Question {currentQuestion + 1} of {totalQuestions}
            </span>
            <span className="text-muted-foreground">
              {answeredCount} answered
            </span>
          </div>
          <div className="flex gap-1">
            {quiz.questions.map((_, index) => (
              <div
                key={index}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  index <= currentQuestion
                    ? "bg-primary"
                    : "bg-muted"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Question Card */}
        <Card className="border-card-border mb-6">
          <CardHeader>
            <QuizMarkdownContent source={currentQ.question} className="text-xl leading-relaxed" />
            {currentQ.questionImageUrl && (
              <img
                src={currentQ.questionImageUrl}
                alt="Question illustration"
                className="mt-4 max-h-80 max-w-full rounded-md border object-contain"
              />
            )}
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={selectedAnswer?.toString()}
              onValueChange={(value) => handleAnswerSelect(currentQ.id, Number(value))}
            >
              <div className="space-y-3">
                {currentQ.options.map((option, index) => (
                  <div
                    key={index}
                    className={`flex items-center space-x-3 p-4 rounded-md border transition-all hover-elevate cursor-pointer ${
                      selectedAnswer === index + 1
                        ? "border-primary bg-primary/5"
                        : "border-card-border"
                    }`}
                    onClick={() => handleAnswerSelect(currentQ.id, index + 1)}
                  >
                    <RadioGroupItem
                      value={(index + 1).toString()}
                      id={`option-${index + 1}`}
                      data-testid={`radio-option-${index + 1}`}
                    />
                    <Label
                      htmlFor={`option-${index + 1}`}
                      className="flex-1 cursor-pointer text-base leading-relaxed"
                    >
                      {option}
                    </Label>
                  </div>
                ))}
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between gap-4">
          <Button
            variant="secondary"
            onClick={() => setCurrentQuestion(Math.max(0, currentQuestion - 1))}
            disabled={currentQuestion === 0}
            data-testid="button-previous"
          >
            Previous
          </Button>
          <div className="flex gap-2">
            {currentQuestion < totalQuestions - 1 ? (
              <Button
                onClick={() => setCurrentQuestion(Math.min(totalQuestions - 1, currentQuestion + 1))}
                data-testid="button-next"
              >
                Next
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={!canSubmit}
                data-testid="button-submit-quiz"
              >
                Submit Quiz
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Results Modal */}
      <Dialog open={showResults} onOpenChange={setShowResults}>
        <DialogContent className="flex max-h-[90dvh] flex-col gap-4 overflow-hidden sm:max-w-lg" data-testid="dialog-quiz-results">
          <DialogHeader className="shrink-0">
            <DialogTitle className="text-center text-2xl">
              {percentage >= quiz.passScore ? "Your next level starts here" : "Keep moving forward"}
            </DialogTitle>
            <DialogDescription className="text-center">
              Preview your shareable quiz achievement, then review your answers below.
            </DialogDescription>
          </DialogHeader>

          <div
            className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pr-1"
            data-testid="quiz-results-scroll-area"
          >
            <section
              aria-label="Achievement card preview"
              className="relative mx-auto aspect-[4/5] w-full max-w-[340px] overflow-hidden rounded-[1.5rem] border border-white/20 bg-gradient-to-br from-teal-950 via-teal-700 to-slate-900 p-5 text-center text-white shadow-xl"
            >
              <div className="pointer-events-none absolute -right-16 -top-12 h-48 w-48 rounded-full bg-white/10" />
              <div className="pointer-events-none absolute -bottom-12 -left-16 h-48 w-48 rounded-full bg-white/10" />
              <div className="relative flex h-full flex-col items-center">
                <p className="text-xs font-extrabold tracking-[0.25em]">LEARNPEDIA</p>
                <p className="mt-1 text-[9px] font-semibold tracking-[0.15em] text-amber-300">LEARNING WITHOUT LIMITS</p>
                <div className="mt-5 flex h-14 w-14 items-center justify-center rounded-full bg-amber-400 text-teal-950 shadow-lg">
                  <Trophy className="h-7 w-7" />
                </div>
                <h2 className="mt-4 text-3xl font-black tracking-tight">LEVEL UP!</h2>
                <p className="mt-1 text-xs text-white/80">
                  {percentage >= quiz.passScore ? "Another milestone unlocked" : "Every try moves you forward"}
                </p>
                <p className="mt-3 text-6xl font-black leading-none text-amber-300">{percentage}%</p>
                <p className="mt-1 text-[10px] font-bold tracking-[0.2em] text-white/75">QUIZ SCORE</p>
                <div className="mt-4 flex min-h-16 w-full flex-1 flex-col justify-center rounded-xl bg-white/10 px-3 py-2">
                  <p className="text-[9px] font-semibold tracking-[0.15em] text-amber-300">ACHIEVEMENT EARNED BY</p>
                  <p className="mt-1 line-clamp-2 text-sm font-bold">{user.fullName}</p>
                  <p className="mt-1 line-clamp-2 text-[10px] text-white/80">{quiz.title}</p>
                </div>
                <div className="mt-4 h-1 w-16 rounded-full bg-amber-300" />
                <p className="mt-2 text-xs font-semibold">learnpedia.app</p>
              </div>
            </section>

            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => void exportAchievement(false)} disabled={isSharing} variant="secondary">
                <Download className="mr-2 h-4 w-4" />
                Download card
              </Button>
              <Button onClick={() => void exportAchievement(true)} disabled={isSharing}>
                <Share2 className="mr-2 h-4 w-4" />
                {isSharing ? "Preparing..." : "Share achievement"}
              </Button>
            </div>

            <Accordion type="single" collapsible className="border-t pt-1">
              <AccordionItem value="answer-review" className="border-b-0">
                <AccordionTrigger className="py-3 text-left font-semibold hover:no-underline">
                  Review questions and answers
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3">
                    {quiz.questions.map((question, index) => {
                    const selectedOption = answers[question.id];
                    const isCorrect = selectedOption === question.correctAnswer;

                    return (
                      <section key={question.id} className="rounded-lg border p-3">
                        <div className="flex items-start gap-2">
                          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                            {index + 1}
                          </span>
                          <div className="min-w-0 flex-1 space-y-3">
                            <QuizMarkdownContent source={question.question} className="font-medium" />
                            {question.questionImageUrl && (
                              <img
                                src={question.questionImageUrl}
                                alt={`Question ${index + 1}`}
                                className="max-h-56 max-w-full rounded-md border object-contain"
                              />
                            )}
                            <div className="space-y-2">
                              {question.options.map((option, optionIndex) => {
                                const optionNumber = optionIndex + 1;
                                const isChosen = selectedOption === optionNumber;
                                const isAnswer = question.correctAnswer === optionNumber;

                                return (
                                  <div
                                    key={optionNumber}
                                    className={`flex items-start gap-2 rounded-md border p-2 text-sm ${
                                      isAnswer
                                        ? "border-emerald-500/50 bg-emerald-500/10"
                                        : isChosen
                                          ? "border-destructive/50 bg-destructive/10"
                                          : "border-transparent bg-muted/40"
                                    }`}
                                  >
                                    {isAnswer ? (
                                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                                    ) : isChosen ? (
                                      <X className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                                    ) : (
                                      <span className="h-4 w-4 shrink-0" />
                                    )}
                                    <span className="min-w-0">{option}</span>
                                    {isChosen && (
                                      <span className="ml-auto shrink-0 text-[10px] font-semibold uppercase text-muted-foreground">
                                        Your answer
                                      </span>
                                    )}
                                    {isAnswer && (
                                      <span className="ml-auto shrink-0 text-[10px] font-semibold uppercase text-emerald-700 dark:text-emerald-300">
                                        Correct
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                            <p className={`text-xs font-semibold ${isCorrect ? "text-emerald-700 dark:text-emerald-300" : "text-destructive"}`}>
                              {isCorrect ? "You got this right" : "Review the correct answer"}
                            </p>
                            {(question.explanation?.trim() || question.explanationImageUrl?.trim()) && (
                              <div className="space-y-2 border-t pt-3">
                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Explanation</p>
                                {question.explanation?.trim() && <QuizMarkdownContent source={question.explanation} />}
                                {question.explanationImageUrl?.trim() && (
                                  <img
                                    src={question.explanationImageUrl}
                                    alt={`Explanation for question ${index + 1}`}
                                    className="max-h-56 max-w-full rounded-md border object-contain"
                                  />
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </section>
                    );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          <DialogFooter className="shrink-0 flex-col gap-2 bg-background pt-2 sm:flex-row">
            <Button
              variant="secondary"
              onClick={handleRetry}
              className="w-full sm:w-auto"
              data-testid="button-retry-quiz"
            >
              Retry Quiz
            </Button>
            <Button
              onClick={handleBackToCourse}
              className="w-full sm:w-auto"
              data-testid="button-back-to-course"
            >
              Back to Course
            </Button>
            {percentage >= quiz.passScore && (
              <Button
                onClick={handleNextModule}
                className="w-full sm:w-auto"
                data-testid="button-next-module"
              >
                Next module
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
