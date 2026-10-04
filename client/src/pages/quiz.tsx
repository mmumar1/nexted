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
import { XCircle, ChevronLeft, Trophy } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { compareModuleOrder } from "@/lib/module-utils";
import { QuizMarkdownContent } from "@/components/quiz/quiz-markdown";
import type { Module, QuizQuestion } from "@shared/schema";

interface QuizData {
  id: string;
  moduleId: string;
  title: string;
  passScore: number;
  questions: QuizQuestion[];
}

export default function Quiz() {
  const [, params] = useRoute("/quiz/:moduleId");
  const [, setLocation] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const moduleId = params?.moduleId || "1";

  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [showResults, setShowResults] = useState(false);
  const [score, setScore] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) {
      setLocation("/login");
    }
  }, [isAuthenticated, setLocation]);

  const { data: quiz, isLoading } = useQuery<QuizData>({
    queryKey: ["/api/quizzes/module", moduleId],
    enabled: !!moduleId,
  });

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

  if (isLoading || !quiz) {
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

  const currentQ = quiz.questions[currentQuestion];
  const selectedAnswer = answers[currentQ.id];
  const totalQuestions = quiz.questions.length;
  const answeredCount = Object.keys(answers).length;
  const canSubmit = answeredCount === totalQuestions;
  const percentage = Math.round((score / totalQuestions) * 100);

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
        <DialogContent className="sm:max-w-md" data-testid="dialog-quiz-results">
          <DialogHeader>
            <div className="flex justify-center mb-4">
              {percentage >= quiz.passScore ? (
                <div className="p-4 bg-chart-3/10 rounded-full">
                  <Trophy className="w-12 h-12 text-chart-3" />
                </div>
              ) : (
                <div className="p-4 bg-chart-4/10 rounded-full">
                  <XCircle className="w-12 h-12 text-chart-4" />
                </div>
              )}
            </div>
            <DialogTitle className="text-center text-2xl">
              {percentage >= quiz.passScore ? "Congratulations!" : "Keep Practicing"}
            </DialogTitle>
            <DialogDescription className="text-center text-base">
              You scored {score} out of {totalQuestions} questions correctly
            </DialogDescription>
          </DialogHeader>

          <div className="py-6">
            <div className="text-center mb-4">
              <div className="text-5xl font-bold text-foreground mb-2">
                {percentage}%
              </div>
              <p className="text-muted-foreground">
                {percentage >= quiz.passScore + 20
                  ? "Outstanding performance!"
                  : percentage >= quiz.passScore
                  ? "Great job!"
                  : `You need ${quiz.passScore}% to pass this quiz.`}
              </p>
            </div>
          </div>

          {quiz.questions.some((question) => question.explanation?.trim()) && (
            <div className="max-h-64 space-y-4 overflow-y-auto border-t pt-4">
              {quiz.questions.map((question, index) => question.explanation?.trim() ? (
                <section key={question.id} className="space-y-2">
                  <h3 className="text-sm font-semibold">Explanation {quiz.questions.length > 1 ? index + 1 : ""}</h3>
                  <QuizMarkdownContent source={question.explanation} />
                </section>
              ) : null)}
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
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
