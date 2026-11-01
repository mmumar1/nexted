import { randomInt } from "crypto";
import type { CbtAttempt, CbtAttemptQuestion, CbtQuestion } from "../shared/schema.js";

export interface CbtStudentQuestion {
  id: string;
  subject: string;
  examYear: number;
  question: string;
  questionImageUrl: string | null;
  options: string[];
  correctAnswer?: number;
  selectedOption?: number;
  explanation?: string | null;
  explanationImageUrl?: string | null;
}

export interface CbtStudentAttempt {
  id: string;
  mode: CbtAttempt["mode"];
  selections: CbtAttempt["selections"];
  durationMinutes: number;
  status: CbtAttempt["status"];
  score: number | null;
  totalQuestions: number;
  startedAt: Date;
  expiresAt: Date;
  serverNow: Date;
  submittedAt: Date | null;
  answers: Record<string, number>;
  questions: CbtStudentQuestion[];
}

export interface CbtAttemptHistoryEntry {
  id: string;
  mode: CbtAttempt["mode"];
  selections: CbtAttempt["selections"];
  durationMinutes: number;
  status: CbtAttempt["status"];
  score: number | null;
  totalQuestions: number;
  startedAt: Date;
  expiresAt: Date;
  submittedAt: Date | null;
}

export function sampleCbtQuestions(questions: CbtQuestion[], count: number): CbtQuestion[] {
  const shuffled = [...questions];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled.slice(0, count);
}

export function shuffleCbtQuestions(questions: CbtQuestion[]): CbtAttemptQuestion[] {
  const shuffled = questions.map((question) => {
    const indexedOptions = question.options.map((text, index) => ({ text, index }));
    for (let index = indexedOptions.length - 1; index > 0; index -= 1) {
      const swapIndex = randomInt(index + 1);
      [indexedOptions[index], indexedOptions[swapIndex]] = [indexedOptions[swapIndex], indexedOptions[index]];
    }

    return {
      id: question.id,
      subject: question.subject,
      examYear: question.examYear,
      question: question.question,
      questionImageUrl: question.questionImageUrl,
      options: indexedOptions.map((option) => option.text),
      correctAnswer: indexedOptions.findIndex((option) => option.index + 1 === question.correctAnswer) + 1,
      explanation: question.explanation,
      explanationImageUrl: question.explanationImageUrl,
    };
  });

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

export function scoreCbtAttempt(
  questions: CbtAttemptQuestion[],
  answers: Record<string, number>,
): number {
  return questions.reduce(
    (score, question) => score + (answers[question.id] === question.correctAnswer ? 1 : 0),
    0,
  );
}

export function toCbtStudentAttempt(attempt: CbtAttempt): CbtStudentAttempt {
  const questions = attempt.questions.map((question): CbtStudentQuestion => {
    const base = {
      id: question.id,
      subject: question.subject,
      examYear: question.examYear,
      question: question.question,
      questionImageUrl: question.questionImageUrl,
      options: question.options,
    };
    if (attempt.status === "in_progress") return base;
    return {
      ...base,
      correctAnswer: question.correctAnswer,
      selectedOption: attempt.answers[question.id],
      explanation: question.explanation,
      explanationImageUrl: question.explanationImageUrl,
    };
  });

  return {
    id: attempt.id,
    mode: attempt.mode,
    selections: attempt.selections,
    durationMinutes: attempt.durationMinutes,
    status: attempt.status,
    score: attempt.score,
    totalQuestions: attempt.questions.length,
    startedAt: attempt.startedAt,
    expiresAt: attempt.expiresAt,
    serverNow: new Date(),
    submittedAt: attempt.submittedAt,
    answers: attempt.answers,
    questions,
  };
}

export function toCbtAttemptHistoryEntry(attempt: CbtAttempt): CbtAttemptHistoryEntry {
  return {
    id: attempt.id,
    mode: attempt.mode,
    selections: attempt.selections,
    durationMinutes: attempt.durationMinutes,
    status: attempt.status,
    score: attempt.score,
    totalQuestions: attempt.questions.length,
    startedAt: attempt.startedAt,
    expiresAt: attempt.expiresAt,
    submittedAt: attempt.submittedAt,
  };
}
