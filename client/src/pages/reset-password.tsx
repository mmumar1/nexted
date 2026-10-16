import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setIsReady(true);
    });

    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) setIsReady(true);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
    } else {
      setMessage("Your password has been updated. You can now sign in with it.");
      await supabase.auth.signOut();
      setTimeout(() => setLocation("/login"), 1200);
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
      <Card className="w-full max-w-md border-card-border">
        <CardHeader className="text-center">
          <div className="text-2xl font-bold text-foreground">LEARNPEDIA</div>
          <CardTitle className="mt-4 text-2xl">Choose a new password</CardTitle>
          <CardDescription>Use at least 8 characters for your new password.</CardDescription>
        </CardHeader>
        <CardContent>
          {!isReady ? (
            <div className="space-y-4">
              <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">This reset link is missing, expired, or invalid.</p>
              <Button className="w-full" onClick={() => setLocation("/forgot-password")}>Request a new link</Button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="new-password"
                    className="pr-10"
                    required
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? "Hide new password" : "Show new password"}
                    aria-pressed={showPassword}
                    data-testid="button-toggle-new-password"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm password</Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    autoComplete="new-password"
                    className="pr-10"
                    required
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowConfirmPassword((visible) => !visible)}
                    aria-label={showConfirmPassword ? "Hide confirmation password" : "Show confirmation password"}
                    aria-pressed={showConfirmPassword}
                    data-testid="button-toggle-confirm-password"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              {message && <p className="rounded-md bg-emerald-500/10 p-3 text-sm text-emerald-700">{message}</p>}
              {error && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={isLoading}>{isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Updating...</> : "Update password"}</Button>
            </form>
          )}
        </CardContent>
        <CardFooter className="justify-center"><Link href="/login" className="text-sm text-primary font-medium hover:underline">Back to sign in</Link></CardFooter>
      </Card>
    </div>
  );
}