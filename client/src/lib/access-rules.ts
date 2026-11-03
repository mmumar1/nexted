export interface CourseAccessState {
  hasActiveSubscription: boolean;
  isUnlocked: boolean;
}

export function canAccessCourse(state: CourseAccessState): boolean {
  return state.hasActiveSubscription || state.isUnlocked;
}

export interface ModuleAccessState {
  hasUnpassedPreviousQuiz: boolean;
  hasPrerequisiteQuiz: boolean;
  prerequisiteQuizPassed: boolean;
  hasActiveSubscription?: boolean;
  isModuleWithinFreeTier?: boolean;
}

export interface ModuleTierItem {
  id: string;
  order: number;
  parentModuleId?: string | null;
}

export function isInFreeModuleTier(
  module: ModuleTierItem,
  modules: ModuleTierItem[],
  freeTopLevelModuleCount = 1,
): boolean {
  const moduleById = new Map(modules.map((item) => [item.id, item]));
  let rootModule = module;
  const visitedIds = new Set([module.id]);

  while (rootModule.parentModuleId) {
    const parent = moduleById.get(rootModule.parentModuleId);
    if (!parent || visitedIds.has(parent.id)) break;
    rootModule = parent;
    visitedIds.add(parent.id);
  }

  return rootModule.order <= freeTopLevelModuleCount;
}

export function isModuleUnlocked(state: ModuleAccessState): boolean {
  if (!state.hasActiveSubscription && state.isModuleWithinFreeTier === false) {
    return false;
  }

  if (state.hasUnpassedPreviousQuiz) return false;
  return !state.hasPrerequisiteQuiz || state.prerequisiteQuizPassed;
}
