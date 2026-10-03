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
      hasPrerequisite: false,
      prerequisiteCompleted: false,
      prerequisiteHasQuiz: false,
      prerequisiteQuizPassed: false,
      hasActiveSubscription: false,
      isModuleWithinFreeTier: false,
    };

    assert.equal(isModuleUnlocked(state), false);
  });

  it('allows a module when all prerequisite steps are satisfied', () => {
    const state: ModuleAccessState = {
      hasPrerequisite: true,
      prerequisiteCompleted: true,
      prerequisiteHasQuiz: true,
      prerequisiteQuizPassed: true,
      hasActiveSubscription: true,
      isModuleWithinFreeTier: true,
    };

    assert.equal(isModuleUnlocked(state), true);
  });

  it('requires completion of the previous module before unlocking the next', () => {
    const state: ModuleAccessState = {
      hasPrerequisite: false,
      prerequisiteCompleted: false,
      prerequisiteHasQuiz: false,
      prerequisiteQuizPassed: false,
      hasPreviousModule: true,
      previousModuleCompleted: false,
      previousModuleHasQuiz: false,
      previousModuleQuizPassed: false,
      hasActiveSubscription: true,
    };

    assert.equal(isModuleUnlocked(state), false);
    assert.equal(isModuleUnlocked({ ...state, previousModuleCompleted: true }), true);
  });

  it('requires the previous module quiz pass mark when that module has a quiz', () => {
    const state: ModuleAccessState = {
      hasPrerequisite: false,
      prerequisiteCompleted: false,
      prerequisiteHasQuiz: false,
      prerequisiteQuizPassed: false,
      hasPreviousModule: true,
      previousModuleCompleted: true,
      previousModuleHasQuiz: true,
      previousModuleQuizPassed: false,
      hasActiveSubscription: true,
    };

    assert.equal(isModuleUnlocked(state), false);
    assert.equal(isModuleUnlocked({ ...state, previousModuleQuizPassed: true }), true);
  });
});
