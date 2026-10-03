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

export function isModuleUnlocked(state: ModuleAccessState): boolean {
  if (!state.hasActiveSubscription && state.isModuleWithinFreeTier === false) {
    return false;
  }

  if (state.hasUnpassedPreviousQuiz) return false;
  return !state.hasPrerequisiteQuiz || state.prerequisiteQuizPassed;
}
