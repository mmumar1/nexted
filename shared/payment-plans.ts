export const PAYMENT_PLANS = {
  monthly: {
    name: "Monthly",
    amount: 1_000,
    durationMonths: 1,
  },
  yearly: {
    name: "Yearly",
    amount: 5_000,
    durationMonths: 12,
  },
} as const;

export type PaymentPlanId = keyof typeof PAYMENT_PLANS;

export function isPaymentPlanId(value: unknown): value is PaymentPlanId {
  return value === "monthly" || value === "yearly";
}

export function getSubscriptionExpiryDate(
  plan: PaymentPlanId,
  paidAt: Date,
): Date {
  const durationMonths = PAYMENT_PLANS[plan].durationMonths;
  const targetMonth = paidAt.getUTCMonth() + durationMonths;
  const targetYear = paidAt.getUTCFullYear() + Math.floor(targetMonth / 12);
  const normalizedMonth = targetMonth % 12;
  const lastDayOfTargetMonth = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate();

  return new Date(Date.UTC(
    targetYear,
    normalizedMonth,
    Math.min(paidAt.getUTCDate(), lastDayOfTargetMonth),
    paidAt.getUTCHours(),
    paidAt.getUTCMinutes(),
    paidAt.getUTCSeconds(),
    paidAt.getUTCMilliseconds(),
  ));
}

export function isSubscriptionActive(
  hasActiveSubscription: boolean,
  expiresAt: Date | string | null | undefined,
  now = new Date(),
): boolean {
  if (!hasActiveSubscription) return false;
  if (!expiresAt) return true;

  const expiryTime = expiresAt instanceof Date ? expiresAt.getTime() : Date.parse(expiresAt);
  return Number.isFinite(expiryTime) && expiryTime > now.getTime();
}
