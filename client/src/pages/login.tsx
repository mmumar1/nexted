import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginData } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { isStaffRole, mapSupabaseProfileToUser } from "@/lib/auth-utils";
import { WhatsAppFloat } from "@/components/whatsapp-float";

type LoginMode = "student" | "staff";

interface LoginProps {
  initialMode?: LoginMode;
  params?: Record<string, string | undefined>;
  inlineModal?: boolean;
  onClose?: () => void;
  switchToRegister?: () => void;
  [key: string]: unknown;
}

export default function Login({
  initialMode = "student",
  inlineModal = false,
  onClose,
  switchToRegister,
}: LoginProps) {
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginMode, setLoginMode] = useState<LoginMode>(initialMode);
  const { login } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginData) => {
    setIsLoading(true);
    setError("");
    
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (authError) {
        throw authError;
      }

      if (!authData.user) {
        throw new Error("Supabase did not return a user account");
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", authData.user.id)
        .single();

      if (profileError) {
        throw profileError;
      }

      const user = mapSupabaseProfileToUser(profile);
      const isStaff = isStaffRole(user.role);
      if (loginMode === "staff" && !isStaff) {
        throw new Error("Choose Staff / Admin only with an instructor or administrator account");
      }
      if (loginMode === "student" && isStaff) {
        throw new Error("Choose Student only with a student account");
      }
      login(user);
      if (inlineModal) {
        onClose?.();
        return;
      }
      setLocation(isStaff ? "/admin" : "/dashboard");
    } catch (err: any) {
      setError(err.message || "Invalid email or password");
    } finally {
      setIsLoading(false);
    }
  };

  const content = (
    <div className={inlineModal ? "w-full" : "min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4"}>
      <div className={`w-full ${inlineModal ? "max-w-none" : "max-w-md space-y-6"}`}>
        <Card className={inlineModal ? "border-0 bg-white shadow-none" : "border-card-border"}>
          <CardHeader className={`space-y-1 text-center ${inlineModal ? "px-5 pb-4 pt-5 sm:px-8 sm:pt-7" : ""}`}>
            {!inlineModal && <div className="flex justify-center mb-4">
              <div className="flex items-center gap-2">
                
                 {/*<div className="p-2 bg-primary rounded-md">
                    <GraduationCap className="w-8 h-8 text-primary-foreground" />
                   
                </div> */}
                
                <div className="text-left">
                  <div className="text-2xl font-bold text-foreground">LEARNPEDIA</div>
                </div>
              </div>
            </div>}
            <CardTitle className="text-2xl font-bold text-[#17243B]">Welcome back</CardTitle>
            <CardDescription className="text-base">
                Sign in to continue your learning journey
            </CardDescription>
          </CardHeader>
          <CardContent className={inlineModal ? "px-5 pb-6 sm:px-8 sm:pb-8" : ""}>
            <div className="mb-6 grid grid-cols-2 rounded-xl border border-[#17243B]/[0.08] bg-[#F3F9F9] p-1" role="group" aria-label="Choose account type">
              <button
                type="button"
                className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${loginMode === "student" ? "bg-white text-[#17243B] shadow-sm" : "text-[#17243B]/55 hover:text-[#17243B]"}`}
                onClick={() => { setLoginMode("student"); setError(""); }}
                aria-pressed={loginMode === "student"}
                data-testid="button-student-login-mode"
              >
                Student
              </button>
              <button
                type="button"
                className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${loginMode === "staff" ? "bg-white text-[#17243B] shadow-sm" : "text-[#17243B]/55 hover:text-[#17243B]"}`}
                onClick={() => { setLoginMode("staff"); setError(""); }}
                aria-pressed={loginMode === "staff"}
                data-testid="button-staff-login-mode"
              >
                Teacher / Admin
              </button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  data-testid="input-email"
                  {...register("email")}
                  className={errors.email ? "border-destructive" : ""}
                />
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    data-testid="input-password"
                    {...register("password")}
                    className={`${errors.password ? "border-destructive" : ""} pr-10`}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                    data-testid="button-toggle-password"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-sm text-destructive">{errors.password.message}</p>
                )}
              </div>

              <div className="text-right">
                <Link href="/forgot-password" className="text-sm text-primary font-medium hover:underline">
                  Forgot password?
                </Link>
              </div>

              {error && (
                <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              <Button
                type="submit"
                className="w-full rounded-lg font-bold"
                disabled={isLoading}
                data-testid="button-login"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>
          </CardContent>
          {!inlineModal && <CardFooter className="flex flex-col space-y-4">
            <div className="text-sm text-center text-muted-foreground">
              Don't have an account?{" "}
              {switchToRegister ? (
                <button
                  type="button"
                  className="text-primary font-medium hover:underline"
                  data-testid="link-register"
                  onClick={switchToRegister}
                >
                  Create account
                </button>
              ) : (
                <Link href="/register" className="text-primary font-medium hover:underline" data-testid="link-register">
                  Create account
                </Link>
              )}
            </div>
          </CardFooter>}
        </Card>

        {!inlineModal && (
          <p className="text-center text-sm text-muted-foreground">
            Join 1,000+ students learning with Learnpedia
          </p>
        )}
      </div>
      {!inlineModal && <WhatsAppFloat />}
    </div>
  );

  return content;
}
