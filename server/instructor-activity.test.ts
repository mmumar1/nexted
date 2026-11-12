import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MemStorage } from "./storage.js";

describe("instructor activity and course timestamps", () => {
  it("records staff logins and rejects non-staff accounts", async () => {
    const storage = new MemStorage();
    const instructor = await storage.createUser({
      email: "instructor@example.com",
      password: "password",
      fullName: "Course Instructor",
      role: "instructor",
    });
    const student = await storage.createUser({
      email: "student@example.com",
      password: "password",
      fullName: "Course Student",
      role: "student",
    });

    assert.equal(instructor.lastLoginAt, null);
    await storage.recordStaffLogin(instructor.id);
    assert.ok((await storage.getUser(instructor.id))?.lastLoginAt instanceof Date);
    await assert.rejects(storage.recordStaffLogin(student.id), /Staff profile was not found/);
  });

  it("updates a course timestamp when its modules change", async () => {
    const storage = new MemStorage();
    const course = await storage.createCourse({
      title: "Course",
      description: "Description",
      accessCode: "",
      instructorId: "instructor-1",
    });
    const initialUpdate = course.updatedAt;
    await new Promise((resolve) => setTimeout(resolve, 5));

    await storage.createModule({
      courseId: course.id,
      title: "Lesson",
      order: 1,
      content: "Lesson content",
      videoUrls: [],
      imageUrl: null,
      parentModuleId: null,
      prerequisiteModuleId: null,
      duration: 30,
    });

    assert.ok((await storage.getCourse(course.id))!.updatedAt.getTime() > initialUpdate.getTime());
  });
});
