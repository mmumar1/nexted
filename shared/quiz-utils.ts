export interface QuizQuestionIndex {
  correctAnswer: number;
  correctAnswerBase?: 0 | 1;
}

export function normalizeQuizQuestionIndex<T extends QuizQuestionIndex>(question: T) {
  return {
    ...question,
    correctAnswer: question.correctAnswerBase === 1 ? question.correctAnswer : question.correctAnswer + 1,
    correctAnswerBase: 1 as const,
  };
}