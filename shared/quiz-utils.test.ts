import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeQuizQuestionIndex } from "./quiz-utils";

describe("quiz answer indexes", () => {
  it("converts legacy zero-based answers to one-based options", () => {
    assert.equal(normalizeQuizQuestionIndex({ correctAnswer: 0 }).correctAnswer, 1);
    assert.equal(normalizeQuizQuestionIndex({ correctAnswer: 3 }).correctAnswer, 4);
  });

  it("leaves explicitly one-based answers unchanged", () => {
    assert.equal(normalizeQuizQuestionIndex({ correctAnswer: 1, correctAnswerBase: 1 }).correctAnswer, 1);
    assert.equal(normalizeQuizQuestionIndex({ correctAnswer: 4, correctAnswerBase: 1 }).correctAnswer, 4);
  });
});