import { ArrowLeft, ArrowRight, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { normalizeYouTubeEmbedUrl } from "@/lib/video";
import { getModuleDisplayLabel } from "@/lib/module-utils";
import { QuizMarkdownContent } from "@/components/quiz/quiz-markdown";
import type { Module } from "@shared/schema";

interface ModuleContentProps {
  module: Module & { isCompleted: boolean; hasQuiz: boolean; isQuizPassed: boolean };
  previousModule?: Module;
  nextModule?: Module;
  requiresSubscription?: boolean;
  isStartingUpgrade?: boolean;
  onTakeQuiz: () => void;
  onSelectModule: (moduleId: string) => void;
  onUpgrade: () => void;
  onRedeemCoupon: () => void;
}

export function ModuleContent({
  module,
  previousModule,
  nextModule,
  requiresSubscription = false,
  isStartingUpgrade = false,
  onTakeQuiz,
  onSelectModule,
  onUpgrade,
  onRedeemCoupon,
}: ModuleContentProps) {
  const embedUrl = normalizeYouTubeEmbedUrl(module.videoUrl);
  const canGoNext = !!nextModule;
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
        <QuizMarkdownContent source={module.content} />

        {module.imageUrl && (
          <img src={module.imageUrl} alt="" className="mt-6 max-h-80 w-full rounded-md object-cover" />
        )}

        {embedUrl && (
          <div className="mt-6 overflow-hidden rounded-md border bg-black">
            <div className="aspect-video">
              <iframe
                className="h-full w-full"
                src={embedUrl}
                title={module.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
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

        {requiresSubscription && (
          <div className="mt-6 flex flex-col gap-3 rounded-md border border-primary/25 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-semibold text-foreground">Unlock the rest of this course</h3>
              <p className="mt-1 text-sm text-muted-foreground">Upgrade to continue, or redeem a discount code.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={onUpgrade} disabled={isStartingUpgrade}>
                {isStartingUpgrade ? "Opening checkout..." : "Upgrade with Paystack"}
              </Button>
              <Button variant="outline" onClick={onRedeemCoupon}>Redeem coupon</Button>
            </div>
          </div>
        )}
      </div>

      <footer className="flex items-center justify-between gap-3 border-t px-5 py-4 sm:px-7">
        <Button variant="ghost" className="gap-2" disabled={!previousModule} onClick={() => previousModule && onSelectModule(previousModule.id)}>
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Previous module</span>
          <span className="sm:hidden">Previous</span>
        </Button>
        <Button variant="outline" className="gap-2" disabled={!nextModule || !canGoNext} onClick={() => nextModule && onSelectModule(nextModule.id)}>
          <span className="hidden sm:inline">Next module</span>
          <span className="sm:hidden">Next</span>
          <ArrowRight className="h-4 w-4" />
        </Button>
      </footer>
    </article>
  );
}
