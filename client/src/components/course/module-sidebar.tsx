import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, Circle, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { getModuleDisplayLabel } from "@/lib/module-utils";
import type { Module } from "@shared/schema";

export interface CourseModuleItem extends Module {
  isCompleted: boolean;
  isLocked: boolean;
  requiresSubscription: boolean;
  hasQuiz: boolean;
  isQuizPassed: boolean;
}

interface ModuleSidebarProps {
  modules: CourseModuleItem[];
  activeModuleId?: string;
  onSelect: (moduleId: string) => void;
}

export function ModuleSidebar({ modules, activeModuleId, onSelect }: ModuleSidebarProps) {
  const completedCount = modules.filter((module) => module.isCompleted).length;
  const progress = modules.length ? (completedCount / modules.length) * 100 : 0;

  const childMap = useMemo(() => {
    const map = new Map<string, CourseModuleItem[]>();
    for (const module of modules) {
      if (!module.parentModuleId) continue;
      const siblings = map.get(module.parentModuleId) ?? [];
      siblings.push(module);
      map.set(module.parentModuleId, siblings.sort((a, b) => a.order - b.order));
    }
    return map;
  }, [modules]);

  const rootModules = useMemo(
    () => modules.filter((module) => !module.parentModuleId).sort((a, b) => a.order - b.order),
    [modules],
  );

  const activeParentId = useMemo(() => {
    if (!activeModuleId) return undefined;
    const activeModule = modules.find((module) => module.id === activeModuleId);
    return activeModule?.parentModuleId ?? undefined;
  }, [activeModuleId, modules]);

  const [expandedIds, setExpandedIds] = useState<string[]>([]);

  useEffect(() => {
    const initialOpen = rootModules
      .filter((module) => (childMap.get(module.id)?.length ?? 0) > 0)
      .map((module) => module.id);

    if (activeParentId) {
      setExpandedIds((prev) => (prev.includes(activeParentId) ? prev : [...prev, activeParentId]));
      return;
    }

    setExpandedIds(initialOpen);
  }, [activeParentId, childMap, rootModules]);

  const renderModuleRow = (module: CourseModuleItem, depth = 0) => {
    const isActive = module.id === activeModuleId;
    const Icon = module.isLocked ? Lock : module.isCompleted ? CheckCircle2 : Circle;
    const children = childMap.get(module.id) ?? [];
    const submoduleCount = children.length;

    if (children.length > 0) {
      return (
        <AccordionItem value={module.id} key={module.id} className="border-0">
          <AccordionTrigger
            disabled={module.isLocked}
            onClick={() => onSelect(module.id)}
            className={cn(
              "rounded-md px-2 py-2 text-left hover:no-underline",
              isActive && "bg-primary text-primary-foreground",
              !isActive && !module.isLocked && "hover:bg-muted",
              module.isLocked && "cursor-not-allowed opacity-50",
            )}
            style={{ paddingLeft: `${10 + depth * 18}px` }}
          >
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex items-start gap-3">
                <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", isActive ? "text-primary-foreground" : module.isCompleted ? "text-chart-3" : "text-muted-foreground")} />
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-[11px] leading-4", isActive ? "text-primary-foreground/80" : "text-muted-foreground")}>
                    {getModuleDisplayLabel(module, modules)}
                  </span>
                  <span className="mt-0.5 block truncate text-sm font-medium">{module.title}</span>
                </span>
                {module.isCompleted && !isActive && <Badge variant="secondary" className="shrink-0 text-[10px]">Done</Badge>}
              </div>
              <div className="flex flex-wrap gap-2 pl-7">
                <Badge variant={isActive ? "secondary" : "outline"} className="w-fit text-[10px]">
                  {submoduleCount} submodules
                </Badge>
                {module.hasQuiz && (
                  <Badge variant={isActive ? "secondary" : "outline"} className="w-fit text-[10px]">
                    {module.isQuizPassed ? "Quiz passed" : "Quiz required"}
                  </Badge>
                )}
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-1 pt-1">
            <div className="space-y-1 border-l border-border/80 pl-2">
              {children.map((child) => renderModuleRow(child, depth + 1))}
            </div>
          </AccordionContent>
        </AccordionItem>
      );
    }

    return (
      <button
        key={module.id}
        type="button"
        onClick={() => !module.isLocked && onSelect(module.id)}
        disabled={module.isLocked}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "flex w-full items-start gap-3 rounded-md px-3 py-3 text-left transition-colors",
          isActive && "bg-primary text-primary-foreground",
          !isActive && !module.isLocked && "hover:bg-muted",
          module.isLocked && "cursor-not-allowed opacity-50",
        )}
        style={{ paddingLeft: `${10 + depth * 18}px` }}
        data-testid={`module-nav-${module.id}`}
      >
        <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", isActive ? "text-primary-foreground" : module.isCompleted ? "text-chart-3" : "text-muted-foreground")} />
        <span className="min-w-0 flex-1">
          <span className={cn("block text-[11px] leading-4", isActive ? "text-primary-foreground/80" : "text-muted-foreground")}>
            {getModuleDisplayLabel(module, modules)}
          </span>
          <span className="mt-0.5 block truncate text-sm font-medium">{module.title}</span>
          <span className={cn("mt-1 block text-xs", isActive ? "text-primary-foreground/70" : "text-muted-foreground")}>
            {module.duration} min
          </span>
        </span>
        {module.isCompleted && !isActive && <Badge variant="secondary" className="shrink-0 text-[10px]">Done</Badge>}
      </button>
    );
  };

  return (
    <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start" aria-label="Course modules">
      <div className="rounded-lg border bg-card p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Course modules</p>
            <p className="text-xs text-muted-foreground">
              {completedCount} of {modules.length} completed
            </p>
          </div>
          <span className="text-sm font-semibold text-primary">{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="h-1.5" />
      </div>

      <nav className="rounded-lg border bg-card p-2">
        <div className="max-h-[70vh] overflow-y-auto overflow-x-hidden pr-1">
          <Accordion type="multiple" value={expandedIds} onValueChange={setExpandedIds} className="space-y-1">
            {rootModules.map((module) => renderModuleRow(module, 0))}
          </Accordion>
        </div>
      </nav>
    </aside>
  );
}
