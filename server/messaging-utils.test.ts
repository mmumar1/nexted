import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Course, CourseConversationSummary, User } from "../shared/schema.js";
import { canAccessCourseConversation, canStartCourseConversation } from "./messaging-utils.js";

const student: User = {
  id: "student-1",
  email: "student@example.test",
  password: "",
  fullName: "Student One",
  role: "student",
  hasActiveSubscription: false,
  subscriptionTier: "none",
  subscriptionPaidAt: null,
  subscriptionExpiresAt: null,
  state: null,
  localGovernmentArea: null,
  phoneNumber: null,
  whatsappNumber: null,
  referralCode: null,
};

const course: Course = {
  id: "course-1",
  title: "Biology",
  description: "Biology course",
  accessCode: "",
  thumbnail: null,
  enrollmentMode: "self",
  instructorId: "teacher-1",
  isPublished: true,
  publishedAt: new Date(),
};

const conversation: CourseConversationSummary = {
  id: "conversation-1",
  courseId: course.id,
  courseTitle: course.title,
  studentId: student.id,
  studentName: student.fullName,
  instructorId: "teacher-1",
  instructorName: "Teacher One",
  createdAt: new Date(),
  updatedAt: new Date(),
  unreadCount: 0,
};

describe("course messaging authorization", () => {
  it("only lets students start conversations for published courses with an assigned instructor", () => {
    assert.equal(canStartCourseConversation(student, course), true);
    assert.equal(canStartCourseConversation(student, { ...course, isPublished: false }), false);
    assert.equal(canStartCourseConversation(student, { ...course, instructorId: null }), false);
    assert.equal(canStartCourseConversation({ ...student, role: "instructor" }, course), false);
  });

  it("limits students to their own course conversation", () => {
    assert.equal(canAccessCourseConversation(student, conversation, course), true);
    assert.equal(canAccessCourseConversation({ ...student, id: "student-2" }, conversation, course), false);
    assert.equal(canAccessCourseConversation(student, conversation, { ...course, isPublished: false }), false);
  });

  it("limits staff access to the course's currently assigned instructor", () => {
    const teacher = { ...student, id: "teacher-1", role: "instructor" };
    const otherTeacher = { ...teacher, id: "teacher-2" };
    assert.equal(canAccessCourseConversation(teacher, conversation, course), true);
    assert.equal(canAccessCourseConversation(otherTeacher, conversation, course), false);
    assert.equal(canAccessCourseConversation({ ...teacher, role: "admin" }, conversation, course), true);
  });
});
