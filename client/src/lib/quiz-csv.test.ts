import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isInitialEmptyQuizQuestion, parseQuizCsv } from "./quiz-csv";

const headers = "question,option_a,option_b,option_c,option_d,correct_answer,explanation,question_image_url,explanation_image_url";

describe("quiz CSV import", () => {
  it("replaces the untouched quiz-builder question placeholder", () => {
    assert.equal(isInitialEmptyQuizQuestion({
      id: "draft",
      question: "",
      questionImageUrl: "",
      explanation: "",
      explanationImageUrl: "",
      options: ["", "", "", ""],
      correctAnswer: "1",
    }), true);

    assert.equal(isInitialEmptyQuizQuestion({
      id: "draft",
      question: "A question already entered",
      questionImageUrl: "",
      explanation: "",
      explanationImageUrl: "",
      options: ["A", "B", "C", "D"],
      correctAnswer: "1",
    }), false);
  });

  it("parses valid questions with letter or numeric answer keys", () => {
    const csv = [
      headers,
      '"What is 2 + 2?","3","4","5","6","B","Basic addition","",""',
      '"Pick option C","A","B","C","D","3","","",""',
    ].join("\r\n");

    const preview = parseQuizCsv(csv);
    assert.equal(preview.issues.length, 0);
    assert.equal(preview.questions.length, 2);
    assert.equal(preview.questions[0].correctAnswer, "2");
    assert.equal(preview.questions[0].explanation, "Basic addition");
    assert.equal(preview.questions[1].correctAnswer, "3");
  });

  it("supports quoted commas, escaped quotes, and multiline questions", () => {
    const csv = [
      headers,
      '"Which phrase includes a comma, and a ""quote""?\nChoose one.","A, one","B","C","D","A","","",""',
    ].join("\n");

    const preview = parseQuizCsv(csv);
    assert.deepEqual(preview.issues, []);
    assert.equal(preview.questions[0].question, 'Which phrase includes a comma, and a "quote"?\nChoose one.');
    assert.equal(preview.questions[0].options[0], "A, one");
  });

  it("blocks the whole file when any row is invalid", () => {
    const csv = [
      headers,
      '"Valid question","A","B","C","D","A","","",""',
      '"Invalid question","A","","C","D","Z","","",""',
    ].join("\n");

    const preview = parseQuizCsv(csv);
    assert.equal(preview.questions.length, 1);
    assert.ok(preview.issues.some((issue) => issue.row === 3 && issue.message.includes("Option B")));
    assert.ok(preview.issues.some((issue) => issue.row === 3 && issue.message.includes("Correct answer")));
  });

  it("reports missing headers and malformed quoted fields", () => {
    const preview = parseQuizCsv('question,option_a\n"unfinished');
    assert.ok(preview.issues.some((issue) => issue.row === 1 && issue.message.includes('Required column "correct_answer"')));
    assert.ok(preview.issues.some((issue) => issue.message.includes("unclosed quoted field")));
  });

  it("requires at least one data row", () => {
    const preview = parseQuizCsv(headers);
    assert.equal(preview.questions.length, 0);
    assert.ok(preview.issues.some((issue) => issue.message.includes("at least one question")));
  });
});
