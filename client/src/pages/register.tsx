import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema, type RegisterData } from "@shared/schema";
import { NIGERIAN_LGAS_BY_STATE, NIGERIAN_STATES, isNigerianState } from "@shared/nigeria-locations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { WhatsAppFloat } from "@/components/whatsapp-float";

interface RegisterProps {
  inlineModal?: boolean;
  onClose?: () => void;
  switchToLogin?: () => void;
  [key: string]: unknown;
}

export default function Register({ inlineModal = false, onClose, switchToLogin }: RegisterProps) {
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<RegisterData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      state: "",
      localGovernmentArea: "",
      phoneNumber: "",
      whatsappNumber: "",
      referralCode: "",
    },
  });
  const selectedState = watch("state");
  const localGovernmentAreas = isNigerianState(selectedState)
    ? NIGERIAN_LGAS_BY_STATE[selectedState]
    : [];

  useEffect(() => {
    if (isAuthenticated) {
      setLocation("/dashboard");
    }
  }, [isAuthenticated, setLocation]);

  const onSubmit = async (data: RegisterData) => {
    setIsLoading(true);
    setError("");

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            full_name: data.fullName,
            state: data.state,
            local_government_area: data.localGovernmentArea,
            phone_number: data.phoneNumber,
            whatsapp_number: data.whatsappNumber || null,
            referral_code: data.referralCode || null,
          },
        },
      });

      if (authError) {
        throw authError;
      }

      toast({
        title: "Account created successfully!",
        description: authData.session
          ? "Please login to continue."
          : "Check your email to confirm your account, then login to continue.",
      });
      if (inlineModal) {
        onClose?.();
        return;
      }
      setLocation("/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const fieldClass = (hasError: boolean) => hasError ? "border-destructive" : "";
  const selectClass = (hasError: boolean) =>
    `h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${hasError ? "border-destructive" : ""}`;

  const content = (
    <div className={inlineModal ? "w-full" : "min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4"}>
      <div className={`w-full ${inlineModal ? "max-w-none" : "max-w-xl space-y-6"}`}>
        <Card className={inlineModal ? "border-0 bg-white shadow-none" : "border-card-border"}>
          <CardHeader className={`space-y-1 text-center ${inlineModal ? "px-5 pb-4 pt-5 sm:px-8 sm:pt-7" : ""}`}>
            {!inlineModal && <div className="flex justify-center mb-4">
              <div className="text-left">
                <div className="text-2xl font-bold text-foreground">Learnpedia</div>
                <div className="text-xs text-muted-foreground">Learn Without limits</div>
              </div>
            </div>}
            <CardTitle className="text-2xl font-bold text-[#17243B]">Create your account</CardTitle>
            <CardDescription className="text-base">
              Start your learning journey today
            </CardDescription>
          </CardHeader>
          <CardContent className={inlineModal ? "px-5 pb-6 sm:px-8 sm:pb-8" : ""}>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-sm font-medium">Full Name</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="John Doe"
                  autoComplete="name"
                  data-testid="input-fullname"
                  {...register("fullName")}
                  className={fieldClass(!!errors.fullName)}
                />
                {errors.fullName && <p className="text-sm text-destructive">{errors.fullName.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  data-testid="input-email"
                  {...register("email")}
                  className={fieldClass(!!errors.email)}
                />
                {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="phoneNumber" className="text-sm font-medium">Phone Number</Label>
                  <Input
                    id="phoneNumber"
                    type="tel"
                    placeholder="+234 801 234 5678"
                    autoComplete="tel"
                    data-testid="input-phone-number"
                    {...register("phoneNumber")}
                    className={fieldClass(!!errors.phoneNumber)}
                  />
                  {errors.phoneNumber && <p className="text-sm text-destructive">{errors.phoneNumber.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="whatsappNumber" className="text-sm font-medium">WhatsApp Number <span className="text-muted-foreground">(optional)</span></Label>
                  <Input
                    id="whatsappNumber"
                    type="tel"
                    placeholder="+234 801 234 5678"
                    autoComplete="tel"
                    data-testid="input-whatsapp-number"
                    {...register("whatsappNumber")}
                    className={fieldClass(!!errors.whatsappNumber)}
                  />
                  {errors.whatsappNumber && <p className="text-sm text-destructive">{errors.whatsappNumber.message}</p>}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="state" className="text-sm font-medium">State</Label>
                  <select
                    id="state"
                    data-testid="select-state"
                    {...register("state", {
                      onChange: () => setValue("localGovernmentArea", "", { shouldValidate: true }),
                    })}
                    className={selectClass(!!errors.state)}
                  >
                    <option value="">Select state</option>
                    {NIGERIAN_STATES.map((state) => (
                      <option key={state} value={state}>
                        {state === "Federal Capital Territory" ? "Federal Capital Territory (FCT)" : state}
                      </option>
                    ))}
                  </select>
                  {errors.state && <p className="text-sm text-destructive">{errors.state.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="localGovernmentArea" className="text-sm font-medium">Local Government Area (LGA)</Label>
                  <select
                    id="localGovernmentArea"
                    data-testid="select-local-government-area"
                    disabled={!selectedState}
                    {...register("localGovernmentArea")}
                    className={selectClass(!!errors.localGovernmentArea)}
                  >
                    <option value="">
                      {selectedState ? "Select local government area" : "Select a state first"}
                    </option>
                    {localGovernmentAreas.map((area) => (
                      <option key={area} value={area}>{area}</option>
                    ))}
                  </select>
                  {errors.localGovernmentArea && <p className="text-sm text-destructive">{errors.localGovernmentArea.message}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  data-testid="input-password"
                  {...register("password")}
                  className={fieldClass(!!errors.password)}
                />
                {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="referralCode" className="text-sm font-medium">Referral Code <span className="text-muted-foreground">(optional)</span></Label>
                <Input
                  id="referralCode"
                  type="text"
                  placeholder="Enter a referral code"
                  autoComplete="off"
                  data-testid="input-referral-code"
                  {...register("referralCode")}
                  className={fieldClass(!!errors.referralCode)}
                />
                {errors.referralCode && <p className="text-sm text-destructive">{errors.referralCode.message}</p>}
              </div>

              {error && (
                <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
                data-testid="button-register"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  "Create Account"
                )}
              </Button>
            </form>
          </CardContent>
          {!inlineModal && <CardFooter className="flex flex-col space-y-4">
            <div className="text-sm text-center text-muted-foreground">
              Already have an account?{" "}
              {switchToLogin ? (
                <button
                  type="button"
                  className="text-primary font-medium hover:underline"
                  data-testid="link-login"
                  onClick={switchToLogin}
                >
                  Sign in
                </button>
              ) : (
                <Link href="/login" className="text-primary font-medium hover:underline" data-testid="link-login">
                  Sign in
                </Link>
              )}
            </div>
          </CardFooter>}
        </Card>

        {!inlineModal && (
          <p className="text-center text-sm text-muted-foreground">
            Join over 1,000+ students learning with Learnpedia.
          </p>
        )}
      </div>
      {!inlineModal && <WhatsAppFloat />}
    </div>
  );

  return content;
}
