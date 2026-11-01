import type { Course, CourseConversationSummary, User } from "../shared/schema.js";

export const isMessagingStaffRole = (role: string) =>
  ["instructor", "admin", "super_admin", "superadmin"].includes(role);

export function canStartCourseConversation(user: User, course: Course): boolean {
  return user.role === "student"
    && course.isPublished
    && !!course.instructorId;
}

export function canAccessCourseConversation(
  user: User,
  conversation: CourseConversationSummary,
  course: Course,
): boolean {
  if (conversation.courseId !== course.id || !course.isPublished) return false;
  if (user.role === "student") return conversation.studentId === user.id;
  return isMessagingStaffRole(user.role) && course.instructorId === user.id;
}
