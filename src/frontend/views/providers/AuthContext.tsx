"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import { supabase } from "@/src/frontend/services/supabase";
import { User, Session } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { Subscription, UserPlanInfo } from "@/src/frontend/models/types";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  subscription: Subscription | null;
  planInfo: UserPlanInfo;
  isLoading: boolean;
  logout: () => Promise<void>;
  refreshSubscription: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const router = useRouter();

  const fetchSubscriptionData = useCallback(async (userId: string) => {
    const { data: subData, error: subError } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subError) {
      console.error("[AuthProvider] fetchSubscriptionData error:", subError);
      return;
    }

    if (subData) {
      setSubscription(subData as Subscription);
    } else {
      console.warn(`[AuthProvider] no subscription found for user ${userId}`);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    async function getInitialSession() {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();
        if (!mounted) return;

        if (error) {
          console.error("Error fetching session:", error);
          setSession(null);
          setUser(null);
          setIsLoading(false);
          return;
        }

        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchSubscriptionData(session.user.id);
        }
      } catch (error) {
        console.error("Error fetching initial Supabase session:", error);
        if (mounted) {
          setSession(null);
          setUser(null);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    getInitialSession();

    const loadTimeout = window.setTimeout(() => {
      if (mounted) {
        console.warn(
          "[AuthProvider] auth init timed out, continuing without session",
        );
        setIsLoading(false);
      }
    }, 8000);

    const {
      data: { subscription: authListener },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        await fetchSubscriptionData(newSession.user.id);
      } else {
        setSubscription(null);
      }
      setIsLoading(false);
    });

    return () => {
      mounted = false;
      clearTimeout(loadTimeout);
      authListener?.unsubscribe();
    };
  }, [fetchSubscriptionData]);

  const logout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const refreshSubscription = useCallback(async () => {
    if (user) {
      await fetchSubscriptionData(user.id);
    }
  }, [user, fetchSubscriptionData]);

  const isPremium =
    subscription?.status === "active" || subscription?.status === "trialing";

  let maxAccounts = 0;
  if (isPremium && subscription?.price_id) {
    const priceId = subscription.price_id;
    if (priceId === process.env.NEXT_PUBLIC_STRIPE_PRICE_BASIC) {
      maxAccounts = 8;
    } else if (priceId === process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO) {
      maxAccounts = 18;
    } else if (priceId === process.env.NEXT_PUBLIC_STRIPE_PRICE_ELITE) {
      maxAccounts = 30;
    }
  }

  const planInfo: UserPlanInfo = { isPremium, maxAccounts };

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#0d0f14",
          color: "#f0f2f8",
          padding: "24px",
          textAlign: "center",
        }}
      >
        <h1>Carregando...</h1>
      </div>
    );
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        subscription,
        planInfo,
        isLoading,
        logout,
        refreshSubscription,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthViewModel() {
  const context = useContext(AuthContext);
  if (context === undefined || context === null) {
    throw new Error("useAuthViewModel must be used within an AuthProvider");
  }
  return context;
}
