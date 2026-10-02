import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isStaffRole, mapSupabaseProfileToUser, type SupabaseProfile } from "./auth-utils";

const profile: SupabaseProfile = {
  id: "user-123",
  email: "learner@example.com",
  full_name: "Learner Example",
  role: "student",
  has_active_subscription: true,
  subscription_tier: "one-time",
  subscription_paid_at: "2026-09-06T10:00:00.000Z",
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
    });
  });

  it("maps a missing subscription date to null", () => {
    const user = mapSupabaseProfileToUser({ ...profile, subscription_paid_at: null });

    assert.equal(user.subscriptionPaidAt, null);
  });

  it("recognizes every staff role but not students", () => {
    assert.equal(isStaffRole("admin"), true);
    assert.equal(isStaffRole("super_admin"), true);
    assert.equal(isStaffRole("instructor"), true);
    assert.equal(isStaffRole("student"), false);
  });
});