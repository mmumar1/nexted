import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Navbar } from "@/components/navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { mapSupabaseProfileToUser } from "@/lib/auth-utils";

interface ProfileForm { fullName: string; email: string }

export default function Profile() {
  const [, setLocation] = useLocation();
  const { user, login, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [couponCode, setCouponCode] = useState("");
  const { register, handleSubmit, formState: { errors } } = useForm<ProfileForm>({
    values: { fullName: user?.fullName || "", email: user?.email || "" },
  });

  useEffect(() => {
    if (!isAuthenticated) setLocation("/login");
  }, [isAuthenticated, setLocation]);

  const updateMutation = useMutation({
    mutationFn: (data: ProfileForm) => apiRequest("PATCH", `/api/users/${user?.id}`, data),
    onSuccess: (data: { user: typeof user }) => {
      if (data.user) login(data.user);
      toast({ title: "Profile updated", description: "Your account details have been saved." });
    },
    onError: (error: Error) => toast({ title: "Update failed", description: error.message, variant: "destructive" }),
  });

  const paymentMutation = useMutation({
    mutationFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("Your Supabase session has expired. Please sign in again.");
      const response = await fetch("/api/payments/paystack/initialize", {
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

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8">
          <p className="text-sm font-medium text-primary">Account</p>
          <h1 className="mt-1 text-3xl font-bold text-foreground">Profile & settings</h1>
          <p className="mt-2 text-muted-foreground">Keep your learner information up to date.</p>
        </div>
        <div className="grid gap-6 md:grid-cols-[1fr_260px]">
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
              {!user.hasActiveSubscription && (
                <>
                  <Button type="button" variant="secondary" className="w-full" onClick={() => paymentMutation.mutate()} disabled={paymentMutation.isPending}>
                    {paymentMutation.isPending ? "Opening Paystack..." : "Pay with Paystack"}
                  </Button>
                  <form className="space-y-2 border-t pt-4" onSubmit={(event) => { event.preventDefault(); redeemCouponMutation.mutate(); }}>
                    <Label htmlFor="subscription-coupon">Discount code</Label>
                    <Input id="subscription-coupon" value={couponCode} onChange={(event) => setCouponCode(event.target.value)} placeholder="Enter coupon code" autoCapitalize="characters" />
                    <Button type="submit" variant="outline" className="w-full" disabled={!couponCode.trim() || redeemCouponMutation.isPending}>
                      {redeemCouponMutation.isPending ? "Applying code..." : "Redeem coupon"}
                    </Button>
                  </form>
                </>
              )}
              <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                One-time payment unlocks published courses after Paystack confirms the transaction.
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
