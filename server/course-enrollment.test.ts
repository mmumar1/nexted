import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MemStorage } from "./storage.js";

describe("course enrollment", () => {
  it("keeps enrollment separate from course content access", async () => {
    const storage = new MemStorage();

    await storage.enrollStudent("student-1", "course-1");

    assert.equal(await storage.isStudentEnrolled("student-1", "course-1"), true);
    assert.equal(await storage.isUserCourseUnlocked("student-1", "course-1"), false);
  });

  it("makes enrollment idempotent and removes only participation", async () => {
    const storage = new MemStorage();
    const first = await storage.enrollStudent("student-1", "course-1");
    const repeated = await storage.enrollStudent("student-1", "course-1");
    await storage.unlockCourse({ userId: "student-1", courseId: "course-1" });

    assert.equal(repeated.id, first.id);
    assert.equal((await storage.getCourseEnrollments("course-1")).length, 1);
    assert.equal(await storage.removeCourseEnrollment("student-1", "course-1"), true);
    assert.equal(await storage.isStudentEnrolled("student-1", "course-1"), false);
    assert.equal(await storage.isUserCourseUnlocked("student-1", "course-1"), true);
  });
});
