import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MemStorage } from "./storage.js";

describe("CBT question classification", () => {
  it("only lists classified published questions in the student catalog", async () => {
    const storage = new MemStorage();
    const [published] = await storage.createCbtQuestions([{
      examType: "jamb",
      subject: "Mathematics",
      examYear: 2025,
      topic: "Algebra",
      question: "Published question?",
      options: ["A", "B", "C", "D"],
      correctAnswer: 1,
      createdBy: "teacher",
    }]);
    await storage.updateCbtQuestion(published.id, { status: "published" });
    const [draft] = await storage.createCbtQuestions([{
      examType: "waec",
      subject: "Mathematics",
      examYear: 2025,
      topic: "Geometry",
      question: "Draft question?",
      options: ["A", "B", "C", "D"],
      correctAnswer: 1,
      createdBy: "teacher",
    }]);

    assert.deepEqual(await storage.getCbtQuestionCatalog(), [{
      examType: "jamb",
      subject: "Mathematics",
      examYear: 2025,
      topic: "Algebra",
      count: 1,
    }]);
    assert.equal((await storage.getCbtQuestions({
      examType: "jamb",
      subject: "Mathematics",
      examYear: 2025,
      requireTopic: true,
      status: "published",
    })).length, 1);
    assert.equal((await storage.getCbtQuestion(draft.id))?.status, "draft");
  });

  it("moves published questions back to draft when bulk reclassified", async () => {
    const storage = new MemStorage();
    const [created] = await storage.createCbtQuestions([{
      examType: "jamb",
      subject: "Mathematics",
      examYear: 2025,
      topic: "Algebra",
      question: "Question?",
      options: ["A", "B", "C", "D"],
      correctAnswer: 1,
      createdBy: "teacher",
    }]);
    await storage.updateCbtQuestion(created.id, {
      status: "published",
      publishedBy: "teacher",
      publishedAt: new Date(),
    });

    const updated = await storage.bulkClassifyCbtQuestions(
      [created.id],
      "waec",
      "Geometry",
      "teacher",
      "teacher",
    );
    const question = await storage.getCbtQuestion(created.id);

    assert.equal(updated, 1);
    assert.equal(question?.examType, "waec");
    assert.equal(question?.topic, "Geometry");
    assert.equal(question?.status, "draft");
    assert.equal(question?.publishedBy, null);
    assert.equal((await storage.getCbtQuestionCatalog()).length, 0);
  });

  it("does not reclassify another teacher's questions", async () => {
    const storage = new MemStorage();
    const [created] = await storage.createCbtQuestions([{
      examType: "jamb",
      subject: "Mathematics",
      examYear: 2025,
      topic: "Algebra",
      question: "Question?",
      options: ["A", "B", "C", "D"],
      correctAnswer: 1,
      createdBy: "teacher-a",
    }]);

    const updated = await storage.bulkClassifyCbtQuestions(
      [created.id],
      "waec",
      "Geometry",
      "teacher-b",
      "teacher-b",
    );

    assert.equal(updated, 0);
    assert.equal((await storage.getCbtQuestion(created.id))?.examType, "jamb");
  });
});
