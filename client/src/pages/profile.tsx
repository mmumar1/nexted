import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Navbar } from "@/components/navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Check, CreditCard, Landmark } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { mapSupabaseProfileToUser } from "@/lib/auth-utils";
import { PAYMENT_PLANS, type PaymentPlanId } from "@shared/payment-plans";

interface ProfileForm { fullName: string; email: string }

interface ManualTransferSubmission {
  id: string;
  plan: PaymentPlanId;
  amount: number;
  bank_name: string;
  bank_reference: string;
  status: "pending" | "approved" | "rejected";
  review_note: string | null;
  created_at: string;
  reviewed_at: string | null;
}

export default function Profile() {
  const [location, setLocation] = useLocation();
  const { user, login, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [couponCode, setCouponCode] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<PaymentPlanId>("monthly");
  const [bankName, setBankName] = useState<"Sterling Bank" | "OPay">("Sterling Bank");
  const [bankReference, setBankReference] = useState("");
  const { register, handleSubmit, formState: { errors } } = useForm<ProfileForm>({
    values: { fullName: user?.fullName || "", email: user?.email || "" },
  });

  useEffect(() => {
    if (!isAuthenticated) setLocation("/login");
  }, [isAuthenticated, setLocation]);

  useEffect(() => {
    const targetId = window.location.hash.slice(1);
    if (!targetId) return;

    window.requestAnimationFrame(() => {
      document.getElementById(decodeURIComponent(targetId))?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, [location]);

  const updateMutation = useMutation({
    mutationFn: (data: ProfileForm) => apiRequest("PATCH", `/api/users/${user?.id}`, data),
    onSuccess: (data: { user: typeof user }) => {
      if (data.user) login(data.user);
      toast({ title: "Profile updated", description: "Your account details have been saved." });
    },
    onError: (error: Error) => toast({ title: "Update failed", description: error.message, variant: "destructive" }),
  });

  const paymentMutation = useMutation({
    mutationFn: async (plan: PaymentPlanId) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("Your Supabase session has expired. Please sign in again.");
      const response = await fetch(`/api/payments/paystack/initialize?plan=${plan}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to start Paystack checkout");
      return result as { authorizationUrl: string };
    },
    onSuccess: (result) => {
      window.location.assign(result.authorizationUrl);
    },
    onError: (error: Error) => toast({ title: "Payment could not start", description: error.message, variant: "destructive" }),
  });

  const manualTransfers = useQuery<ManualTransferSubmission[]>({
    queryKey: ["/api/payments/manual-transfer"],
    enabled: isAuthenticated && !!user?.id,
    refetchInterval: (query) => query.state.data?.some((submission) => submission.status === "pending") ? 15_000 : false,
  });

  useEffect(() => {
    if (!user?.id || user.hasActiveSubscription || !manualTransfers.data?.some((submission) => submission.status === "approved")) return;
    let cancelled = false;
    void Promise.resolve(
      supabase.from("profiles").select("*").eq("id", user.id).single(),
    ).then(({ data, error }) => {
        if (error) throw error;
        if (!data) throw new Error("Profile was not returned after payment approval");
        if (!cancelled) login(mapSupabaseProfileToUser(data));
      })
      .catch((error: unknown) => console.error("Failed to refresh profile after manual payment approval:", error));
    return () => { cancelled = true; };
  }, [manualTransfers.data, login, user?.hasActiveSubscription, user?.id]);

  const manualTransferMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/payments/manual-transfer", {
      plan: selectedPlan,
      bankName,
      bankReference,
    }),
    onSuccess: () => {
      setBankReference("");
      queryClient.invalidateQueries({ queryKey: ["/api/payments/manual-transfer"] });
      toast({
        title: "Transfer submitted for review",
        description: "Your course access will begin after an administrator verifies the bank transfer.",
      });
    },
    onError: (error: Error) => toast({ title: "Transfer could not be submitted", description: error.message, variant: "destructive" }),
  });

  const redeemCouponMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/payments/coupons/redeem", { code: couponCode }),
    onSuccess: (result: { profile: Parameters<typeof mapSupabaseProfileToUser>[0] }) => {
      login(mapSupabaseProfileToUser(result.profile));
      setCouponCode("");
      toast({ title: "Coupon redeemed", description: "Your subscription is active and published courses are unlocked." });
    },
    onError: (error: Error) => toast({ title: "Coupon could not be redeemed", description: error.message, variant: "destructive" }),
  });

  if (!user) return null;

  const activePlan = PAYMENT_PLANS[selectedPlan];
  const hasPendingManualTransfer = manualTransfers.data?.some((submission) => submission.status === "pending") ?? false;
  const pendingTransfer = manualTransfers.data?.find((submission) => submission.status === "pending");
  const receiptPlan = pendingTransfer?.plan ?? selectedPlan;
  const receiptBank = pendingTransfer?.bank_name ?? bankName;
  const receiptReference = pendingTransfer?.bank_reference ?? bankReference.trim();
  const transferMessage = encodeURIComponent(
    `Hello Learnpedia, I transferred ₦${PAYMENT_PLANS[receiptPlan].amount.toLocaleString("en-NG")} for the ${PAYMENT_PLANS[receiptPlan].name} plan. Account email: ${user.email}. Bank: ${receiptBank}. Transaction reference: ${receiptReference || "I will attach my receipt and transaction reference."}`,
  );
  const whatsappTransferUrl = `https://wa.me/2349030578183?text=${transferMessage}`;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8">
          <p className="text-sm font-medium text-primary">Account</p>
          <h1 className="mt-1 text-3xl font-bold text-foreground">Profile & settings</h1>
          <p className="mt-2 text-muted-foreground">Keep your learner information up to date.</p>
        </div>
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_300px]">
          <Card>
            <CardHeader>
              <CardTitle>Personal details</CardTitle>
              <CardDescription>These details are used across your learning workspace.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-5" onSubmit={handleSubmit((data) => updateMutation.mutate(data))}>
                <div className="space-y-2">
                  <Label htmlFor="profile-name">Full name</Label>
                  <Input id="profile-name" {...register("fullName", { required: "Enter your full name" })} />
                  {errors.fullName && <p className="text-sm text-destructive">{errors.fullName.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile-email">Email address</Label>
                  <Input id="profile-email" type="email" {...register("email", { required: "Enter your email" })} />
                  {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
                </div>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "Saving..." : "Save changes"}
                </Button>
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Account access</CardTitle><CardDescription>Your current workspace permissions.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div><p className="text-xs text-muted-foreground">Role</p><Badge className="mt-2 capitalize">{user.role}</Badge></div>
              <div><p className="text-xs text-muted-foreground">Member email</p><p className="mt-1 break-words text-sm font-medium">{user.email}</p></div>
              <div><p className="text-xs text-muted-foreground">Subscription</p>
                <Badge className={`mt-2 capitalize ${user.hasActiveSubscription ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground"}`}>
                  {user.hasActiveSubscription ? user.subscriptionTier || "one-time" : "none"}
                </Badge>
              </div>
              {user.hasActiveSubscription && (
                <p className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm text-muted-foreground">
                  Your plan is active{user.subscriptionExpiresAt
                    ? ` until ${new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(user.subscriptionExpiresAt)}`
                    : ""}.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card id="payment-options" className="mt-8 scroll-mt-24 overflow-hidden">
          <CardHeader className="border-b bg-muted/20">
            <p className="text-sm font-semibold text-primary">ALL-ACCESS PLANS</p>
            <CardTitle className="text-2xl">Choose your learning plan</CardTitle>
            <CardDescription>Each plan unlocks all courses and learning packs for its full access period.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8 p-5 sm:p-8">
            {user.hasActiveSubscription ? (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5 text-sm text-foreground">
                Your subscription is active. You can choose a new plan once your current access period ends.
              </div>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  {(Object.entries(PAYMENT_PLANS) as [PaymentPlanId, typeof PAYMENT_PLANS[PaymentPlanId]][]).map(([id, plan]) => {
                    const isSelected = selectedPlan === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => setSelectedPlan(id)}
                        className={`relative rounded-2xl border p-5 text-left transition-all hover:border-primary/50 sm:p-6 ${isSelected ? "border-primary bg-primary/[0.04] ring-2 ring-primary/15" : "border-border bg-card"}`}
                      >
                        {id === "yearly" && (
                          <span className="absolute right-4 top-4 rounded-full bg-amber-400/20 px-3 py-1 text-xs font-bold text-amber-800 dark:text-amber-200">
                            Save 58%
                          </span>
                        )}
                        <span className="block text-sm font-bold uppercase tracking-wide text-muted-foreground">{plan.name}</span>
                        <span className="mt-3 block text-3xl font-extrabold text-foreground">
                          ₦{plan.amount.toLocaleString("en-NG")}
                          <span className="ml-1 text-sm font-medium text-muted-foreground">/{id === "monthly" ? "month" : "year"}</span>
                        </span>
                        <span className="mt-4 flex items-center gap-2 text-sm font-semibold text-foreground">
                          <Check className="h-4 w-4 text-primary" />
                          Unlocks all courses
                        </span>
                        <span className="mt-2 block text-sm text-muted-foreground">
                          Access for {plan.durationMonths === 1 ? "1 month" : "12 months"} from payment verification.
                        </span>
                        <span className={`mt-5 inline-flex rounded-full px-3 py-1 text-xs font-bold ${isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                          {isSelected ? "Selected plan" : "Select plan"}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div>
                  <h3 className="text-lg font-bold text-foreground">Choose how to pay</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Selected: {activePlan.name} plan — ₦{activePlan.amount.toLocaleString("en-NG")}
                  </p>
                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div className="rounded-2xl border p-5">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><CreditCard className="h-5 w-5" /></span>
                        <div>
                          <h4 className="font-bold text-foreground">Pay online</h4>
                          <p className="text-sm text-muted-foreground">Secure checkout with Paystack</p>
                        </div>
                      </div>
                      <Button type="button" className="mt-5 w-full" onClick={() => paymentMutation.mutate(selectedPlan)} disabled={paymentMutation.isPending}>
                        {paymentMutation.isPending ? "Opening secure checkout..." : `Pay ₦${activePlan.amount.toLocaleString("en-NG")} with Paystack`}
                      </Button>
                    </div>

                    <div className="rounded-2xl border p-5">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"><Landmark className="h-5 w-5" /></span>
                        <div>
                          <h4 className="font-bold text-foreground">Bank transfer</h4>
                          <p className="text-sm text-muted-foreground">Transfer the exact plan amount</p>
                        </div>
                      </div>
                      <div className="mt-5 space-y-3 rounded-xl bg-muted/40 p-4 text-sm">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sterling Bank</p>
                          <p className="mt-1 font-semibold text-foreground">Account number: 0514105438</p>
                          <p className="text-muted-foreground">Musa Umar Musa</p>
                        </div>
                        <div className="border-t pt-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">OPay</p>
                          <p className="mt-1 font-semibold text-foreground">Account number: 9030578183</p>
                          <p className="text-muted-foreground">Musa Umar Musa</p>
                        </div>
                      </div>
                      <p className="mt-4 text-xs leading-5 text-muted-foreground">
                        After transferring ₦{activePlan.amount.toLocaleString("en-NG")}, submit the transaction reference below. Your payment remains pending until an administrator verifies it.
                      </p>
                      {manualTransfers.isError && (
                        <p className="mt-3 text-sm text-destructive">Unable to load your transfer status. Refresh the page to try again.</p>
                      )}
                      {manualTransfers.data?.map((submission) => (
                        <div key={submission.id} className="mt-4 rounded-xl border p-4 text-sm">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-semibold capitalize">{submission.plan} plan · ₦{Number(submission.amount).toLocaleString("en-NG")}</p>
                            <Badge variant={submission.status === "pending" ? "secondary" : submission.status === "approved" ? "default" : "destructive"}>
                              {submission.status === "pending" ? "Pending admin approval" : submission.status}
                            </Badge>
                          </div>
                          <p className="mt-1 text-muted-foreground">{submission.bank_name} · Reference: {submission.bank_reference}</p>
                          <p className="mt-1 text-xs text-muted-foreground">Submitted {new Date(submission.created_at).toLocaleString("en-NG")}</p>
                          {submission.review_note && <p className="mt-2 text-muted-foreground">Admin note: {submission.review_note}</p>}
                        </div>
                      ))}
                      {!hasPendingManualTransfer && (
                        <form
                          className="mt-4 space-y-3"
                          onSubmit={(event) => {
                            event.preventDefault();
                            manualTransferMutation.mutate();
                          }}
                        >
                          <div className="space-y-2">
                            <Label htmlFor="transfer-bank">Transferred to</Label>
                            <select
                              id="transfer-bank"
                              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                              value={bankName}
                              onChange={(event) => {
                                if (event.target.value === "Sterling Bank" || event.target.value === "OPay") {
                                  setBankName(event.target.value);
                                }
                              }}
                            >
                              <option value="Sterling Bank">Sterling Bank</option>
                              <option value="OPay">OPay</option>
                            </select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="bank-reference">Bank transaction reference</Label>
                            <Input
                              id="bank-reference"
                              value={bankReference}
                              onChange={(event) => setBankReference(event.target.value)}
                              placeholder="Enter the reference from your transfer receipt"
                              minLength={4}
                              maxLength={120}
                              required
                            />
                          </div>
                          <Button
                            type="submit"
                            variant="outline"
                            className="w-full"
                            disabled={manualTransferMutation.isPending || manualTransfers.isPending || manualTransfers.isError || !bankReference.trim() || hasPendingManualTransfer}
                          >
                            {manualTransferMutation.isPending ? "Submitting transfer..." : "Submit transfer for approval"}
                          </Button>
                        </form>
                      )}
                      <Button asChild variant="outline" className="mt-3 w-full">
                        <a href={whatsappTransferUrl} target="_blank" rel="noreferrer">
                          Send receipt through WhatsApp
                        </a>
                      </Button>
                    </div>
                  </div>
                </div>

                <form id="coupon-code" className="max-w-xl space-y-2 border-t pt-6" onSubmit={(event) => { event.preventDefault(); redeemCouponMutation.mutate(); }}>
                  <Label htmlFor="subscription-coupon">Have a discount code?</Label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input id="subscription-coupon" value={couponCode} onChange={(event) => setCouponCode(event.target.value)} placeholder="Enter coupon code" autoCapitalize="characters" />
                    <Button type="submit" variant="outline" className="sm:shrink-0" disabled={!couponCode.trim() || redeemCouponMutation.isPending}>
                      {redeemCouponMutation.isPending ? "Applying..." : "Redeem code"}
                    </Button>
                  </div>
                </form>
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
