export interface CourseAccessState {
  hasActiveSubscription: boolean;
  isUnlocked: boolean;
}

export function canAccessCourse(state: CourseAccessState): boolean {
  return state.hasActiveSubscription || state.isUnlocked;
}

export interface ModuleAccessState {
  hasPrerequisite: boolean;
  prerequisiteCompleted: boolean;
  prerequisiteHasQuiz: boolean;
  prerequisiteQuizPassed: boolean;
  hasActiveSubscription?: boolean;
  isModuleWithinFreeTier?: boolean;
}

export function isModuleUnlocked(state: ModuleAccessState): boolean {
  if (!state.hasActiveSubscription && state.isModuleWithinFreeTier === false) {
    return false;
  }

  if (!state.hasPrerequisite) {
    return true;
  }

  if (!state.prerequisiteCompleted) {
    return false;
  }

  if (state.prerequisiteHasQuiz && !state.prerequisiteQuizPassed) {
    return false;
  }

  return true;
}
