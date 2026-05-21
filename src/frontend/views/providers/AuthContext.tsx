'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase } from '@/src/frontend/services/supabase';
import { User, Session } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { Subscription, UserPlanInfo } from '@/src/frontend/models/types';

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
    const { data: subData } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (subData) setSubscription(subData as Subscription);
  }, []);

  useEffect(() => {
    let mounted = true;

    async function getInitialSession() {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (mounted) {
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
        setIsLoading(false);
      }
    }

    getInitialSession();

    const { data: { subscription: authListener } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
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
      authListener?.unsubscribe();
    };
  }, [fetchSubscriptionData]);

  const logout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const refreshSubscription = async () => {
    if (user) {
      await fetchSubscriptionData(user.id);
    }
  };

  const isPremium = subscription?.status === 'active' || subscription?.status === 'trialing';

  let maxAccounts = 0;
  if (isPremium && subscription?.price_id) {
    const priceId = subscription.price_id;
    if (priceId === process.env.NEXT_PUBLIC_STRIPE_PRICE_BASIC) {
      maxAccounts = 5;
    } else if (priceId === process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO) {
      maxAccounts = 15;
    } else if (priceId === process.env.NEXT_PUBLIC_STRIPE_PRICE_ELITE) {
      maxAccounts = Infinity;
    }
  }

  const planInfo: UserPlanInfo = { isPremium, maxAccounts };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      subscription,
      planInfo,
      isLoading,
      logout,
      refreshSubscription
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthViewModel() {
  const context = useContext(AuthContext);
  if (context === undefined || context === null) {
    throw new Error('useAuthViewModel must be used within an AuthProvider');
  }
  return context;
}
