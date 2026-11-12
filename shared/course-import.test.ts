import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { courseImportPayloadSchema } from "./course-import.js";

describe("course import validation", () => {
  it("accepts appending a single module with a lesson", () => {
    const result = courseImportPayloadSchema.safeParse({
      title: "Course",
      description: "Course description",
      modules: [
        {
          title: "Module 1",
          order: 1,
          content: "",
          videoUrls: [],
          parentIndex: null,
        },
        {
          title: "Lesson 1",
          order: 1,
          content: "Lesson explanation",
          videoUrls: [],
          parentIndex: 0,
        },
      ],
    });

    assert.equal(result.success, true);
  });

  it("rejects a module without a lesson", () => {
    const result = courseImportPayloadSchema.safeParse({
      title: "Course",
      description: "Course description",
      modules: [
        {
          title: "Module 1",
          order: 1,
          content: "",
          videoUrls: [],
          parentIndex: null,
        },
      ],
    });

    assert.equal(result.success, false);
    if (!result.success) {
      assert.ok(result.error.issues.some((issue) => issue.message.includes("at least one lesson")));
    }
  });
});
