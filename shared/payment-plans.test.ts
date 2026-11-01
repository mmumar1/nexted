import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getSubscriptionExpiryDate, isSubscriptionActive, PAYMENT_PLANS } from "./payment-plans.js";

describe("subscription payment plans", () => {
  it("uses the current monthly and yearly prices", () => {
    assert.equal(PAYMENT_PLANS.monthly.amount, 1_000);
    assert.equal(PAYMENT_PLANS.yearly.amount, 5_000);
  });

  it("adds a calendar month and clamps dates to the end of the month", () => {
    const expiry = getSubscriptionExpiryDate("monthly", new Date("2026-01-31T12:30:00.000Z"));
    assert.equal(expiry.toISOString(), "2026-02-28T12:30:00.000Z");
  });

  it("adds a year while preserving leap-day behavior", () => {
    const expiry = getSubscriptionExpiryDate("yearly", new Date("2024-02-29T08:00:00.000Z"));
    assert.equal(expiry.toISOString(), "2025-02-28T08:00:00.000Z");
  });

  it("treats missing expiry as a legacy lifetime subscription", () => {
    assert.equal(isSubscriptionActive(true, null), true);
    assert.equal(isSubscriptionActive(false, null), false);
  });

  it("expires plans at their configured expiration instant", () => {
    assert.equal(
      isSubscriptionActive(true, "2026-11-01T00:00:00.000Z", new Date("2026-10-31T23:59:59.000Z")),
      true,
    );
    assert.equal(
      isSubscriptionActive(true, "2026-11-01T00:00:00.000Z", new Date("2026-11-01T00:00:00.000Z")),
      false,
    );
  });
});
