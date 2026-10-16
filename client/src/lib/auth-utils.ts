import type { User } from "@shared/schema";

export interface SupabaseProfile {
  id: string;
  email: string;
  full_name: string;
  role: string;
  has_active_subscription: boolean;
  subscription_tier: string;
  subscription_paid_at: string | null;
  state: string | null;
  local_government_area: string | null;
  phone_number: string | null;
  whatsapp_number: string | null;
  referral_code: string | null;
}

export function isStaffRole(role: string): boolean {
  return ["admin", "super_admin", "instructor"].includes(role);
}

export function mapSupabaseProfileToUser(profile: SupabaseProfile): User {
  return {
    id: profile.id,
    email: profile.email,
    password: "",
    fullName: profile.full_name,
    role: profile.role,
    hasActiveSubscription: profile.has_active_subscription,
    subscriptionTier: profile.subscription_tier,
    subscriptionPaidAt: profile.subscription_paid_at
      ? new Date(profile.subscription_paid_at)
      : null,
    state: profile.state ?? null,
    localGovernmentArea: profile.local_government_area ?? null,
    phoneNumber: profile.phone_number ?? null,
    whatsappNumber: profile.whatsapp_number ?? null,
    referralCode: profile.referral_code ?? null,
  };
}