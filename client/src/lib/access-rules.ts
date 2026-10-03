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
  hasPreviousModule?: boolean;
  previousModuleCompleted?: boolean;
  previousModuleHasQuiz?: boolean;
  previousModuleQuizPassed?: boolean;
  hasActiveSubscription?: boolean;
  isModuleWithinFreeTier?: boolean;
}

export function isModuleUnlocked(state: ModuleAccessState): boolean {
  if (!state.hasActiveSubscription && state.isModuleWithinFreeTier === false) {
    return false;
  }

  if (state.hasPreviousModule) {
    if (!state.previousModuleCompleted) return false;
    if (state.previousModuleHasQuiz && !state.previousModuleQuizPassed) return false;
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
