import { useState } from 'react';
import { useAuthViewModel } from '@/src/frontend/views/providers/AuthContext';

export type PlanName = 'Free' | 'Basic' | 'Pro' | 'Elite';

export function getPlanName(priceId: string | undefined, isPremium: boolean): PlanName {
  if (!isPremium || !priceId) return 'Free';
  if (priceId === process.env.NEXT_PUBLIC_STRIPE_PRICE_BASIC) return 'Basic';
  if (priceId === process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO) return 'Pro';
  if (priceId === process.env.NEXT_PUBLIC_STRIPE_PRICE_ELITE) return 'Elite';
  return 'Free';
}

export function useProfileViewModel() {
  const { user, session, subscription, planInfo, refreshSubscription } = useAuthViewModel();
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelDate, setCancelDate] = useState<string | null>(null);
  const [isSubscribing, setIsSubscribing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const planName = getPlanName(subscription?.price_id, planInfo.isPremium);

  const handleCancelSubscription = async () => {
    if (!session?.access_token) return;
    setIsCancelling(true);
    setError(null);
    try {
      const res = await fetch('/api/stripe/cancel', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao cancelar assinatura.');
      setCancelDate(data.cancelAt);
      await refreshSubscription();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsCancelling(false);
    }
  };

  const handleChangePlan = async (priceId: string) => {
    if (!session?.access_token) return;
    setIsSubscribing(priceId);
    setError(null);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ priceId }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('Falha ao iniciar checkout.');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubscribing(null);
    }
  };

  const formatDate = (isoDate: string) => {
    return new Date(isoDate).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  return {
    user,
    subscription,
    planInfo,
    planName,
    isCancelling,
    cancelDate,
    isSubscribing,
    error,
    handleCancelSubscription,
    handleChangePlan,
    formatDate,
  };
}
