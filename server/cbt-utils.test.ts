import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { CbtAttempt, CbtQuestion } from "../shared/schema.js";
import { sampleCbtQuestions, scoreCbtAttempt, shuffleCbtQuestions, toCbtStudentAttempt } from "./cbt-utils.js";

const question = (id: string, correctAnswer: number): CbtQuestion => ({
  id,
  subject: "Mathematics",
  examYear: 2025,
  question: `Question ${id}`,
  questionImageUrl: null,
  options: ["A", "B", "C", "D"],
  correctAnswer,
  explanation: "Because it is correct",
  explanationImageUrl: null,
  status: "published",
  createdBy: "teacher",
  updatedBy: "teacher",
  publishedBy: "teacher",
  publishedAt: new Date("2025-01-01T00:00:00.000Z"),
  archivedAt: null,
  createdAt: new Date("2025-01-01T00:00:00.000Z"),
  updatedAt: new Date("2025-01-01T00:00:00.000Z"),
});

describe("CBT attempt utilities", () => {
  it("shuffles question and option order without changing the correct option", () => {
    const [shuffled] = shuffleCbtQuestions([question("q1", 3)]);
    assert.deepEqual([...shuffled.options].sort(), ["A", "B", "C", "D"]);
    assert.equal(shuffled.options[shuffled.correctAnswer - 1], "C");
  });

  it("samples without replacement", () => {
    const bank = [question("q1", 1), question("q2", 2), question("q3", 3), question("q4", 4)];
    const sample = sampleCbtQuestions(bank, 3);
    assert.equal(sample.length, 3);
    assert.equal(new Set(sample.map((item) => item.id)).size, 3);
    assert.ok(sample.every((item) => bank.some((candidate) => candidate.id === item.id)));
  });

  it("scores one point for each correct answer with no penalty for wrong or blank answers", () => {
    const questions = shuffleCbtQuestions([question("q1", 1), question("q2", 4), question("q3", 2)]);
    const first = questions.find((item) => item.id === "q1")!;
    const second = questions.find((item) => item.id === "q2")!;
    assert.equal(scoreCbtAttempt(questions, {
      q1: first.correctAnswer,
      q2: second.correctAnswer === 1 ? 2 : 1,
    }), 1);
  });

  it("does not return answer keys or explanations while an attempt is active", () => {
    const questions = shuffleCbtQuestions([question("q1", 2)]);
    const attempt: CbtAttempt = {
      id: "attempt",
      userId: "student",
      mode: "self",
      selections: [{ subject: "Mathematics", examYear: 2025, questionCount: 1 }],
      durationMinutes: 15,
      questions,
      answers: {},
      status: "in_progress",
      score: null,
      startedAt: new Date(),
      expiresAt: new Date(Date.now() + 15 * 60_000),
      submittedAt: null,
      createdAt: new Date(),
    };
    const response = toCbtStudentAttempt(attempt);
    assert.equal(response.questions[0].correctAnswer, undefined);
    assert.equal(response.questions[0].explanation, undefined);
  });
});
