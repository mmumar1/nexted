import { ArrowLeft, ArrowRight, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { normalizeYouTubeEmbedUrl } from "@/lib/video";
import { getModuleDisplayLabel } from "@/lib/module-utils";
import type { Module } from "@shared/schema";

interface ModuleContentProps {
  module: Module & { isCompleted: boolean; hasQuiz: boolean; isQuizPassed: boolean };
  previousModule?: Module;
  nextModule?: Module;
  onTakeQuiz: () => void;
  onSelectModule: (moduleId: string) => void;
}

export function ModuleContent({
  module,
  previousModule,
  nextModule,
  onTakeQuiz,
  onSelectModule,
}: ModuleContentProps) {
  const embedUrl = normalizeYouTubeEmbedUrl(module.videoUrl);
  const canGoNext = !!nextModule && module.isCompleted;
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
        <div
          className="prose prose-sm max-w-none text-foreground"
          dangerouslySetInnerHTML={{ __html: module.content }}
        />

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
          {module.hasQuiz && !module.isQuizPassed && (
            <Button className="gap-2" onClick={onTakeQuiz} data-testid={`button-take-quiz-${module.id}`}>
              <Play className="h-4 w-4" />
              Take Module Quiz
            </Button>
          )}
        </div>
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
