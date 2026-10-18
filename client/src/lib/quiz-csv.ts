import { quizQuestionSchema } from "@shared/schema";

export interface ImportedQuizQuestion {
  id: string;
  question: string;
  questionImageUrl: string;
  explanation: string;
  explanationImageUrl: string;
  options: string[];
  correctAnswer: string;
}

export interface QuizCsvIssue {
  row: number;
  message: string;
}

export interface QuizCsvPreview {
  questions: ImportedQuizQuestion[];
  issues: QuizCsvIssue[];
}

export function isInitialEmptyQuizQuestion(question: ImportedQuizQuestion): boolean {
  return !question.question.trim()
    && !question.questionImageUrl.trim()
    && !question.explanation.trim()
    && !question.explanationImageUrl.trim()
    && question.options.every((option) => !option.trim())
    && question.correctAnswer === "1";
}

const requiredHeaders = ["question", "option_a", "option_b", "option_c", "option_d", "correct_answer"];
const optionalHeaders = ["explanation", "question_image_url", "explanation_image_url"];
const supportedHeaders = [...requiredHeaders, ...optionalHeaders];

function parseCsvRows(csv: string): { rows: string[][]; issues: QuizCsvIssue[] } {
  const rows: string[][] = [];
  const issues: QuizCsvIssue[] = [];
  let fields: string[] = [];
  let field = "";
  let inQuotes = false;
  let closedQuote = false;
  let rowNumber = 1;
  let rowStart = 1;

  const finishField = () => {
    fields.push(field);
    field = "";
    closedQuote = false;
  };

  const finishRow = () => {
    finishField();
    if (fields.some((value) => value.trim())) rows.push(fields);
    fields = [];
    rowNumber += 1;
    rowStart = rowNumber;
  };

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    const nextCharacter = csv[index + 1];

    if (inQuotes) {
      if (character === '"' && nextCharacter === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        inQuotes = false;
        closedQuote = true;
      } else {
        if (character === "\n") rowNumber += 1;
        field += character;
      }
      continue;
    }

    if (closedQuote && character !== "," && character !== "\r" && character !== "\n" && !/\s/.test(character)) {
      issues.push({ row: rowStart, message: "Unexpected text after a quoted field." });
      closedQuote = false;
      field += character;
      continue;
    }

    if (character === '"' && field.length === 0) {
      inQuotes = true;
    } else if (character === ",") {
      finishField();
    } else if (character === "\n") {
      finishRow();
    } else if (character === "\r") {
      if (nextCharacter !== "\n") finishRow();
    } else {
      field += character;
    }
  }

  if (inQuotes) {
    issues.push({ row: rowStart, message: "This row has an unclosed quoted field." });
  }

  if (field.length || fields.length) finishRow();

  return { rows, issues };
}

export function parseQuizCsv(csv: string): QuizCsvPreview {
  const normalizedCsv = csv.replace(/^\uFEFF/, "");
  const { rows, issues } = parseCsvRows(normalizedCsv);
  if (rows.length === 0) {
    return { questions: [], issues: [...issues, { row: 1, message: "The CSV file is empty." }] };
  }

  const headers = rows[0].map((header) => header.trim().toLowerCase());
  const headerIndexes = new Map<string, number>();

  headers.forEach((header, index) => {
    if (!header) {
      issues.push({ row: 1, message: `Column ${index + 1} is missing a header.` });
    } else if (headerIndexes.has(header)) {
      issues.push({ row: 1, message: `The "${header}" header appears more than once.` });
    } else if (!supportedHeaders.includes(header)) {
      issues.push({ row: 1, message: `Unknown column "${header}". Use the provided CSV template.` });
    } else {
      headerIndexes.set(header, index);
    }
  });

  requiredHeaders.forEach((header) => {
    if (!headerIndexes.has(header)) {
      issues.push({ row: 1, message: `Required column "${header}" is missing.` });
    }
  });

  const questions: ImportedQuizQuestion[] = [];
  rows.slice(1).forEach((row, index) => {
    const csvRow = index + 2;
    if (row.length !== headers.length) {
      issues.push({ row: csvRow, message: `Expected ${headers.length} columns but found ${row.length}.` });
      return;
    }

    const value = (header: string) => {
      const columnIndex = headerIndexes.get(header);
      return columnIndex === undefined ? "" : (row[columnIndex] || "").trim();
    };
    const questionText = value("question");
    const options = ["option_a", "option_b", "option_c", "option_d"].map(value);
    const answerKey = value("correct_answer").toUpperCase();
    const answerNumbers: Record<string, number> = { A: 1, B: 2, C: 3, D: 4, "1": 1, "2": 2, "3": 3, "4": 4 };
    const correctAnswer = answerNumbers[answerKey];
    const questionId = crypto.randomUUID();
    const validation = quizQuestionSchema.safeParse({
      id: questionId,
      question: questionText,
      questionImageUrl: value("question_image_url") || undefined,
      options,
      correctAnswer,
      correctAnswerBase: 1,
      explanation: value("explanation") || undefined,
      explanationImageUrl: value("explanation_image_url") || undefined,
    });

    if (!questionText) {
      issues.push({ row: csvRow, message: "Question text is required." });
    }
    options.forEach((option, optionIndex) => {
      if (!option) issues.push({ row: csvRow, message: `Option ${String.fromCharCode(65 + optionIndex)} is required.` });
    });
    if (!correctAnswer) {
      issues.push({ row: csvRow, message: 'Correct answer must be A, B, C, D, or 1, 2, 3, 4.' });
    }

    if (!validation.success) {
      validation.error.issues.forEach((issue) => {
        const path = issue.path.join(".");
        if (
          (path === "question" && !questionText)
          || (path.startsWith("options") && options.some((option) => !option))
          || (path === "correctAnswer" && !correctAnswer)
          || path === "id"
        ) return;
        issues.push({ row: csvRow, message: issue.message });
      });
      return;
    }

    questions.push({
      id: questionId,
      question: validation.data.question,
      questionImageUrl: validation.data.questionImageUrl || "",
      explanation: validation.data.explanation || "",
      explanationImageUrl: validation.data.explanationImageUrl || "",
      options: validation.data.options,
      correctAnswer: String(validation.data.correctAnswer),
    });
  });

  if (questions.length === 0 && rows.length === 1) {
    issues.push({ row: 2, message: "Add at least one question row below the headers." });
  }

  return { questions, issues };
}
