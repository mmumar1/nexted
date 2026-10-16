import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from "react";
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
  const profileRequestId = useRef(0);
  const loadedUserId = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadProfile = async (userId: string, requestId: number) => {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      if (error) throw error;
      if (mounted && profileRequestId.current === requestId) {
        loadedUserId.current = userId;
        setUser(normalizeUser(mapSupabaseProfileToUser(profile as SupabaseProfile)));
        setIsLoading(false);
      }
    };

    const loadSessionProfile = (userId: string) => {
      if (loadedUserId.current !== userId) {
        loadedUserId.current = null;
        setUser(null);
        setIsLoading(true);
      }
      const requestId = ++profileRequestId.current;
      window.setTimeout(() => {
        void loadProfile(userId, requestId).catch((error) => {
          console.error("Failed to load Supabase profile:", error);
          if (mounted && profileRequestId.current === requestId) {
            if (!loadedUserId.current) setUser(null);
            setIsLoading(false);
          }
        });
      }, 0);
    };

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        profileRequestId.current++;
        loadedUserId.current = null;
        setUser(null);
        setIsLoading(false);
        return;
      }

      if (event === "TOKEN_REFRESHED" && loadedUserId.current === session.user.id) return;
      loadSessionProfile(session.user.id);
    });

    const refreshSessionProfile = () => {
      if (document.visibilityState !== "visible") return;
      void supabase.auth.getSession().then(({ data, error }) => {
        if (error) {
          console.error("Failed to restore Supabase session:", error);
          return;
        }
        const sessionUser = data.session?.user;
        if (!sessionUser) {
          profileRequestId.current++;
          loadedUserId.current = null;
          setUser(null);
          setIsLoading(false);
          return;
        }
        if (loadedUserId.current !== sessionUser.id) loadSessionProfile(sessionUser.id);
      }).catch((error) => console.error("Failed to restore Supabase session:", error));
    };

    document.addEventListener("visibilitychange", refreshSessionProfile);

    return () => {
      mounted = false;
      document.removeEventListener("visibilitychange", refreshSessionProfile);
      authListener.subscription.unsubscribe();
    };
  }, []);

  const login = (user: User) => {
    loadedUserId.current = user.id;
    setUser(normalizeUser(user));
    setIsLoading(false);
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
