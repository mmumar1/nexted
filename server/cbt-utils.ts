import { randomInt } from "crypto";
import { z } from "zod";
import { cbtExamTypeSchema } from "../shared/schema.js";
import type { CbtAttempt, CbtAttemptQuestion, CbtQuestion } from "../shared/schema.js";

export const cbtAttemptRequestSchema = z.object({
  examType: cbtExamTypeSchema,
  mode: z.enum(["self", "mock"]),
  durationMinutes: z.number().int().min(15).max(120),
  selections: z.array(z.object({
    subject: z.string().trim().min(1).max(80),
    examYear: z.number().int().min(1950).max(2100).optional(),
    topics: z.array(z.string().trim().min(1).max(120)).min(1).max(50).optional(),
    questionCount: z.number().int().min(1).max(200),
  })).min(1).max(4),
}).superRefine((input, context) => {
  if (input.mode === "mock" && input.durationMinutes !== 120) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["durationMinutes"],
      message: "Mock tests use a 120-minute duration.",
    });
  }

  const seenSubjects = new Set<string>();
  let totalQuestions = 0;
  input.selections.forEach((selection, index) => {
    const subjectKey = selection.subject.toLowerCase();
    if (seenSubjects.has(subjectKey)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["selections", index],
        message: "A subject can only be selected once.",
      });
    }
    seenSubjects.add(subjectKey);
    totalQuestions += selection.questionCount;

    if (input.mode === "mock") {
      if (selection.examYear !== undefined || selection.topics?.length) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["selections", index],
          message: "Mock tests do not use year or topic filters.",
        });
      }
      const standardCount = standardMockQuestionCount(selection.subject);
      if (selection.questionCount !== standardCount) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["selections", index, "questionCount"],
          message: `${selection.subject} mock tests require ${standardCount} questions.`,
        });
      }
    } else if (selection.examYear === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["selections", index, "examYear"],
        message: "Choose an exam year for each self-test subject.",
      });
    }

    if (selection.topics && new Set(selection.topics.map((topic) => topic.toLowerCase())).size !== selection.topics.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["selections", index, "topics"],
        message: "A topic can only be selected once.",
      });
    }
  });

  if (input.mode === "mock") {
    if (input.selections.length !== 4) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["selections"],
        message: "Mock tests require English and three other subjects.",
      });
    }
    if (!input.selections.some((selection) => /^english(?:\b|$)/i.test(selection.subject))) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["selections"],
        message: "English must be included in every mock test.",
      });
    }
  }

  if (input.mode === "self" && ![15, 30, 45, 60, 90, 120].includes(input.durationMinutes)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["durationMinutes"],
      message: "Choose one of the available self-test durations.",
    });
  }
  if (totalQuestions > 500) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["selections"],
      message: "A single test cannot contain more than 500 questions.",
    });
  }
});

export interface CbtStudentQuestion {
  id: string;
  subject: string;
  examYear: number;
  topic?: string | null;
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
  examType: CbtAttempt["examType"];
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
  examType: CbtAttempt["examType"];
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

export function standardMockQuestionCount(subject: string): number {
  return /^english(?:\b|$)/i.test(subject) ? 60 : 40;
}

export function sampleCbtQuestions(questions: CbtQuestion[], count: number): CbtQuestion[] {
  const shuffled = [...questions];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled.slice(0, count);
}

export function sampleCbtQuestionsAcrossTopics(questions: CbtQuestion[], count: number): CbtQuestion[] {
  const grouped = new Map<string, CbtQuestion[]>();
  for (const question of questions) {
    const topic = question.topic?.trim();
    if (!topic) continue;
    const group = grouped.get(topic) ?? [];
    group.push(question);
    grouped.set(topic, group);
  }

  const groups = Array.from(grouped.values(), (group) => sampleCbtQuestions(group, group.length));
  const selected: CbtQuestion[] = [];
  while (selected.length < count) {
    for (let index = groups.length - 1; index > 0; index -= 1) {
      const swapIndex = randomInt(index + 1);
      [groups[index], groups[swapIndex]] = [groups[swapIndex], groups[index]];
    }

    let addedFromAnyTopic = false;
    for (const group of groups) {
      if (group.length === 0 || selected.length === count) continue;
      selected.push(group.pop()!);
      addedFromAnyTopic = true;
    }
    if (!addedFromAnyTopic) break;
  }
  return selected;
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
      topic: question.topic,
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
      topic: question.topic,
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
    examType: attempt.examType,
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
    examType: attempt.examType,
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
