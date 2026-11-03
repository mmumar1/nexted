import { ArrowLeft, ArrowRight, BookOpenCheck, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { normalizeYouTubeEmbedUrl } from "@/lib/video";
import { getModuleDisplayLabel } from "@/lib/module-utils";
import { QuizMarkdownContent } from "@/components/quiz/quiz-markdown";
import { LessonSpeechControls } from "@/components/course/lesson-speech-controls";
import type { Module } from "@shared/schema";

interface ModuleContentProps {
  module: Module & { isCompleted: boolean; hasQuiz: boolean; isQuizPassed: boolean };
  previousModule?: Module;
  nextModule?: Module;
  requiresSubscription?: boolean;
  showSubscriptionPrompt?: boolean;
  onTakeQuiz: () => void;
  onSelectModule: (moduleId: string) => void;
  onRequestSubscription: () => void;
  onDismissSubscriptionPrompt: () => void;
  onUpgrade: () => void;
  onRedeemCoupon: () => void;
}

export function ModuleContent({
  module,
  previousModule,
  nextModule,
  requiresSubscription = false,
  showSubscriptionPrompt = false,
  onTakeQuiz,
  onSelectModule,
  onRequestSubscription,
  onDismissSubscriptionPrompt,
  onUpgrade,
  onRedeemCoupon,
}: ModuleContentProps) {
  const videoEmbeds = (module.videoUrls?.length
    ? module.videoUrls
    : module.videoUrl
      ? [module.videoUrl]
      : [])
    .map((videoUrl) => normalizeYouTubeEmbedUrl(videoUrl))
    .filter((embedUrl): embedUrl is string => !!embedUrl);
  const moduleLabel = getModuleDisplayLabel(module, [previousModule ?? module, nextModule ?? module, module].filter(Boolean) as Module[]);

  return (
    <article className="min-w-0 rounded-lg border bg-card">
      <div className="border-b px-5 py-5 sm:px-7">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge variant="outline">{moduleLabel}</Badge>
          <Badge variant="outline">{module.duration} min</Badge>
          {module.isCompleted && <Badge variant="secondary">Completed</Badge>}
          {module.hasQuiz && module.isQuizPassed && <Badge variant="secondary">Quiz passed</Badge>}
        </div>
        <h2 className="text-2xl font-bold text-foreground">{module.title}</h2>
      </div>

      <div className="px-5 py-6 sm:px-7">
        <LessonSpeechControls source={module.content} />
        <QuizMarkdownContent source={module.content} enableImageLightbox />

        {module.imageUrl && (
          <img src={module.imageUrl} alt="" className="mt-6 max-h-80 w-full rounded-md object-cover" />
        )}

        {videoEmbeds.length > 0 && (
          <div className="mt-8 space-y-6" aria-label="Module videos">
            {videoEmbeds.map((embedUrl, index) => (
              <section key={`${embedUrl}-${index}`} className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">Video {index + 1}</h3>
                <div className="w-full overflow-hidden rounded-lg border bg-black shadow-sm">
                  <div className="aspect-video">
                    <iframe
                      className="h-full w-full"
                      src={embedUrl}
                      title={`${module.title} - Video ${index + 1}`}
                      loading="lazy"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      referrerPolicy="strict-origin-when-cross-origin"
                      allowFullScreen
                    />
                  </div>
                </div>
              </section>
            ))}
          </div>
        )}

        <div className="mt-8 flex flex-wrap gap-3 border-t pt-5">
          {module.hasQuiz && (
            <Button className="gap-2" onClick={onTakeQuiz} data-testid={`button-take-quiz-${module.id}`}>
              <Play className="h-4 w-4" />
              {module.isQuizPassed ? "Retake Module Quiz" : "Take Module Quiz"}
            </Button>
          )}
        </div>

        <Dialog
          open={requiresSubscription && showSubscriptionPrompt}
          onOpenChange={(open) => {
            if (!open) onDismissSubscriptionPrompt();
          }}
        >
          <DialogContent
            className="inset-0 flex h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 flex-col justify-center overflow-y-auto rounded-none border-0 bg-slate-950/85 p-4 backdrop-blur-md sm:inset-0 sm:h-[100dvh] sm:w-full sm:max-w-none sm:rounded-none sm:p-8 [&>button]:right-5 [&>button]:top-5 [&>button]:z-10 [&>button]:rounded-full [&>button]:bg-background [&>button]:p-2 [&>button]:opacity-100 [&>button]:shadow-md"
            data-testid="dialog-course-subscription-prompt"
          >
            <section className="mx-auto w-full max-w-2xl overflow-hidden rounded-3xl border bg-card shadow-2xl">
              <div className="bg-gradient-to-br from-primary/15 via-primary/5 to-transparent px-6 pb-7 pt-10 text-center sm:px-12 sm:pb-10 sm:pt-14">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
                  <BookOpenCheck className="h-8 w-8" aria-hidden="true" />
                </div>
                <Badge variant="secondary" className="mb-4">All-course access</Badge>
                <DialogHeader className="items-center space-y-3">
                  <DialogTitle className="max-w-xl text-3xl font-extrabold leading-tight sm:text-4xl">
                    Unlock all courses and modules on Learnpedia
                  </DialogTitle>
                  <DialogDescription className="max-w-lg text-base leading-relaxed sm:text-lg">
                    Choose a monthly or yearly all-access plan to continue learning this course and explore every other course on the platform.
                  </DialogDescription>
                </DialogHeader>
              </div>
              <div className="space-y-5 px-6 pb-7 sm:px-12 sm:pb-10">
                <div className="rounded-xl border bg-muted/40 p-4 text-center text-sm text-muted-foreground">
                  Your access stays active for the period included with the plan you choose. No payment is made until you select a plan and complete checkout.
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                  <Button size="lg" className="w-full sm:w-auto" onClick={onUpgrade}>
                    View payment plans
                  </Button>
                  <Button size="lg" variant="outline" className="w-full sm:w-auto" onClick={onRedeemCoupon}>
                    Redeem a coupon
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  className="mx-auto block text-muted-foreground"
                  onClick={onDismissSubscriptionPrompt}
                >
                  Continue with the free modules
                </Button>
              </div>
            </section>
          </DialogContent>
        </Dialog>
      </div>

      <footer className="flex items-center justify-between gap-3 border-t px-5 py-4 sm:px-7">
        <Button variant="ghost" className="gap-2" disabled={!previousModule} onClick={() => previousModule && onSelectModule(previousModule.id)}>
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Previous module</span>
          <span className="sm:hidden">Previous</span>
        </Button>
        <Button
          variant="outline"
          className="gap-2"
          disabled={!nextModule && !requiresSubscription}
          aria-expanded={requiresSubscription ? showSubscriptionPrompt : undefined}
          onClick={() => {
            if (nextModule) onSelectModule(nextModule.id);
            else if (requiresSubscription) onRequestSubscription();
          }}
        >
          <span className="hidden sm:inline">Next module</span>
          <span className="sm:hidden">Next</span>
          <ArrowRight className="h-4 w-4" />
        </Button>
      </footer>
    </article>
  );
}
