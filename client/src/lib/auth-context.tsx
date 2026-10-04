import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { User } from "@shared/schema";
import { supabase } from "@/lib/supabase";
import { mapSupabaseProfileToUser, type SupabaseProfile } from "@/lib/auth-utils";

interface AuthContextType {
  user: User | null;
  login: (user: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function normalizeUser(user: User): User {
  return {
    ...user,
    hasActiveSubscription: !!user.hasActiveSubscription,
    subscriptionTier: user.subscriptionTier ?? "none",
    subscriptionPaidAt: user.subscriptionPaidAt ? new Date(user.subscriptionPaidAt as unknown as string | Date) : null,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadProfile = async (userId: string) => {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      if (error) throw error;
      if (mounted) setUser(normalizeUser(mapSupabaseProfileToUser(profile as SupabaseProfile)));
    };

    void supabase.auth.getSession().then(async ({ data, error }) => {
      if (error) console.error("Failed to restore Supabase session:", error);
      try {
        if (data.session?.user) await loadProfile(data.session.user.id);
      } catch (profileError) {
        console.error("Failed to load Supabase profile:", profileError);
        if (mounted) setUser(null);
      } finally {
        if (mounted) setIsLoading(false);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        setUser(null);
        return;
      }
      if (session?.user) void loadProfile(session.user.id).catch((error) => console.error("Failed to load Supabase profile:", error));
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const login = (user: User) => {
    setUser(normalizeUser(user));
  };

  const logout = () => {
    void supabase.auth.signOut();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
