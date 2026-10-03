import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  canAccessCourse,
  isModuleUnlocked,
  type CourseAccessState,
  type ModuleAccessState,
} from './access-rules';

describe('access rules', () => {
  it('grants all-course access to active subscribers without an access code', () => {
    const state: CourseAccessState = {
      hasActiveSubscription: true,
      isUnlocked: false,
    };

    assert.equal(canAccessCourse(state), true);
  });

  it('allows non-subscribers onto the free tier without an access code', () => {
    const state: CourseAccessState = {
      hasActiveSubscription: false,
      isUnlocked: true,
    };

    assert.equal(canAccessCourse(state), true);
  });

  it('locks modules beyond the free tier for non-subscribers', () => {
    const state: ModuleAccessState = {
      hasUnpassedPreviousQuiz: false,
      hasPrerequisiteQuiz: false,
      prerequisiteQuizPassed: false,
      hasActiveSubscription: false,
      isModuleWithinFreeTier: false,
    };

    assert.equal(isModuleUnlocked(state), false);
  });

  it('allows a module when all prerequisite steps are satisfied', () => {
    const state: ModuleAccessState = {
      hasUnpassedPreviousQuiz: false,
      hasPrerequisiteQuiz: true,
      prerequisiteQuizPassed: true,
      hasActiveSubscription: true,
      isModuleWithinFreeTier: true,
    };

    assert.equal(isModuleUnlocked(state), true);
  });

  it('allows navigation without manual completion when prior modules have no quiz', () => {
    const state: ModuleAccessState = {
      hasUnpassedPreviousQuiz: false,
      hasPrerequisiteQuiz: false,
      prerequisiteQuizPassed: false,
      hasActiveSubscription: true,
    };

    assert.equal(isModuleUnlocked(state), true);
  });

  it('requires passing any earlier module quiz before unlocking later modules', () => {
    const state: ModuleAccessState = {
      hasUnpassedPreviousQuiz: true,
      hasPrerequisiteQuiz: false,
      prerequisiteQuizPassed: false,
      hasActiveSubscription: true,
    };

    assert.equal(isModuleUnlocked(state), false);
    assert.equal(isModuleUnlocked({ ...state, hasUnpassedPreviousQuiz: false }), true);
  });

  it('requires an explicitly assigned prerequisite quiz without requiring completion', () => {
    const state: ModuleAccessState = {
      hasUnpassedPreviousQuiz: false,
      hasPrerequisiteQuiz: true,
      prerequisiteQuizPassed: false,
      hasActiveSubscription: true,
    };

    assert.equal(isModuleUnlocked(state), false);
    assert.equal(isModuleUnlocked({ ...state, prerequisiteQuizPassed: true }), true);
  });
});
