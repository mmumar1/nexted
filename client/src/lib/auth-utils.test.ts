import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isStaffRole, mapSupabaseProfileToUser, type SupabaseProfile } from "./auth-utils";
import { insertModuleSchema, quizQuestionSchema, registerSchema } from "@shared/schema";
import { NIGERIAN_LGAS_BY_STATE, NIGERIAN_STATES } from "@shared/nigeria-locations";

const profile: SupabaseProfile = {
  id: "user-123",
  email: "learner@example.com",
  full_name: "Learner Example",
  role: "student",
  has_active_subscription: true,
  subscription_tier: "one-time",
  subscription_paid_at: "2026-09-06T10:00:00.000Z",
  subscription_expires_at: null,
  state: "Lagos",
  local_government_area: "Ikeja",
  phone_number: "+234 801 234 5678",
  whatsapp_number: null,
  referral_code: "WELCOME",
};

describe("Supabase auth helpers", () => {
  it("maps a Supabase profile to the app user shape", () => {
    const user = mapSupabaseProfileToUser(profile);

    assert.deepEqual(user, {
      id: "user-123",
      email: "learner@example.com",
      password: "",
      fullName: "Learner Example",
      role: "student",
      hasActiveSubscription: true,
      subscriptionTier: "one-time",
      subscriptionPaidAt: new Date("2026-09-06T10:00:00.000Z"),
      subscriptionExpiresAt: null,
      state: "Lagos",
      localGovernmentArea: "Ikeja",
      phoneNumber: "+234 801 234 5678",
      whatsappNumber: null,
      referralCode: "WELCOME",
      lastLoginAt: null,
    });
  });

  it("maps the last recorded sign-in timestamp", () => {
    const user = mapSupabaseProfileToUser({
      ...profile,
      last_login_at: "2026-11-14T12:30:00.000Z",
    });

    assert.equal(user.lastLoginAt?.toISOString(), "2026-11-14T12:30:00.000Z");
  });

  it("maps a missing subscription date to null", () => {
    const user = mapSupabaseProfileToUser({ ...profile, subscription_paid_at: null });

    assert.equal(user.subscriptionPaidAt, null);
  });

  it("expires subscriptions based on the saved end date", () => {
    const user = mapSupabaseProfileToUser({
      ...profile,
      subscription_tier: "monthly",
      subscription_expires_at: "2020-01-01T00:00:00.000Z",
    });

    assert.equal(user.subscriptionExpiresAt?.toISOString(), "2020-01-01T00:00:00.000Z");
    assert.equal(user.hasActiveSubscription, false);
  });

  it("recognizes every staff role but not students", () => {
    assert.equal(isStaffRole("admin"), true);
    assert.equal(isStaffRole("super_admin"), true);
    assert.equal(isStaffRole("instructor"), true);
    assert.equal(isStaffRole("student"), false);
  });

  it("provides all Nigerian states and 774 state-specific local government areas", () => {
    assert.equal(NIGERIAN_STATES.length, 37);
    assert.equal(Object.values(NIGERIAN_LGAS_BY_STATE).reduce((count, lgas) => count + lgas.length, 0), 774);
  });

  it("validates registration details and rejects an LGA from another state", () => {
    const registration = {
      fullName: "Learner Example",
      email: "learner@example.com",
      password: "password123",
      state: "Lagos",
      localGovernmentArea: "Ikeja",
      phoneNumber: "+234 801 234 5678",
      whatsappNumber: "",
      referralCode: "",
    };

    assert.equal(registerSchema.safeParse(registration).success, true);
    assert.equal(registerSchema.safeParse({
      ...registration,
      localGovernmentArea: "Aba North",
    }).success, false);
  });

  it("accepts a question image URL and rejects unsafe protocols", () => {
    const question = {
      id: "question-1",
      question: "What does this diagram show?",
      questionImageUrl: "https://cdn.example.com/diagram.png",
      options: ["A", "B", "C", "D"],
      correctAnswer: 1,
      correctAnswerBase: 1,
      explanation: "The diagram illustrates the correct answer.",
    };

    assert.equal(quizQuestionSchema.safeParse(question).success, true);
    assert.equal(quizQuestionSchema.safeParse({
      ...question,
      questionImageUrl: "javascript:alert(1)",
    }).success, false);
  });

  it("accepts HTTP(S) module image URLs and rejects unsafe protocols", () => {
    const module = {
      courseId: "course-1",
      title: "Lesson",
      order: 1,
      content: "Lesson content",
      imageUrl: "https://cdn.example.com/lesson.png",
    };

    assert.equal(insertModuleSchema.safeParse(module).success, true);
    assert.equal(insertModuleSchema.safeParse({
      ...module,
      imageUrl: "javascript:alert(1)",
    }).success, false);
  });
});