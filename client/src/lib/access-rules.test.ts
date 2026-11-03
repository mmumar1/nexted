import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  canAccessCourse,
  isInFreeModuleTier,
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

  it('keeps submodules of the first parent module in the free tier', () => {
    const modules = [
      { id: 'parent-1', order: 1 },
      { id: 'submodule-1-2', order: 2, parentModuleId: 'parent-1' },
      { id: 'parent-2', order: 2 },
    ];

    assert.equal(isInFreeModuleTier(modules[1], modules), true);
  });

  it('locks the second parent module and its submodules outside the free tier', () => {
    const modules = [
      { id: 'parent-1', order: 1 },
      { id: 'parent-2', order: 2 },
      { id: 'submodule-2-1', order: 1, parentModuleId: 'parent-2' },
    ];

    assert.equal(isInFreeModuleTier(modules[1], modules), false);
    assert.equal(isInFreeModuleTier(modules[2], modules), false);
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
