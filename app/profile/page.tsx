'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/src/frontend/views/components/Navbar';
import { useProfileViewModel } from '@/src/frontend/viewmodels/useProfileViewModel';
import { useAuthViewModel } from '@/src/frontend/views/providers/AuthContext';
import styles from './page.module.css';

const PLANS = [
  {
    name: 'Basic',
    price: 'R$9/mês',
    features: ['Até 5 contas', 'Automação diária', 'Suporte da comunidade'],
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_BASIC,
    color: '#60a5fa',
  },
  {
    name: 'Pro',
    price: 'R$29/mês',
    features: ['Até 15 contas', 'Automação prioritária', 'Suporte por email'],
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO,
    color: '#818cf8',
    popular: true,
  },
  {
    name: 'Elite',
    price: 'R$99/mês',
    features: ['Contas ilimitadas', 'Automação VIP', 'Gerente dedicado', 'SLA garantido'],
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ELITE,
    color: '#fbbf24',
  },
];

export default function ProfilePage() {
  const { isLoading: isAuthLoading, user } = useAuthViewModel();
  const router = useRouter();
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const {
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
  } = useProfileViewModel();

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.push('/login');
    }
  }, [user, isAuthLoading, router]);

  if (isAuthLoading || !user) return null;

  const confirmCancel = async () => {
    await handleCancelSubscription();
    setShowCancelConfirm(false);
  };

  const planBadgeClass =
    planName === 'Elite' ? styles.badgeElite
    : planName === 'Pro' ? styles.badgePro
    : planName === 'Basic' ? styles.badgeBasic
    : styles.badgeFree;

  return (
    <div className={styles.wrapper}>
      <Navbar />
      <main className={styles.main}>
        <div className={styles.content}>

          {/* Header da página */}
          <div className={styles.pageHeader}>
            <button className={styles.backBtn} onClick={() => router.push('/')}>
              ← Voltar
            </button>
            <h1 className={styles.pageTitle}>Meu Perfil</h1>
          </div>

          {/* Card: Informações da conta */}
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>📋 Informações da Conta</h2>
            <div className={styles.infoRow}>
              <div className={styles.avatarLarge}>
                {(user.user_metadata?.name || user.email || 'U').charAt(0).toUpperCase()}
              </div>
              <div className={styles.infoDetails}>
                <p className={styles.infoName}>
                  {user.user_metadata?.name || 'Usuário'}
                </p>
                <p className={styles.infoEmail}>{user.email}</p>
                <span className={`${styles.planBadge} ${planBadgeClass}`}>
                  {planName === 'Elite' ? '★' : planName === 'Pro' ? '✦' : '○'} Plano {planName}
                </span>
              </div>
            </div>

            {/* Datas da assinatura */}
            {planInfo.isPremium && subscription?.current_period_end && (
              <div className={styles.subInfo}>
                <p className={styles.subInfoText}>
                  {subscription?.cancel_at_period_end
                    ? `⚠️ Assinatura cancelada — acesso até ${formatDate(subscription.current_period_end)}`
                    : `Próxima cobrança: ${formatDate(subscription.current_period_end)}`}
                </p>
              </div>
            )}
          </section>

          {/* Card: Gerenciar assinatura — somente para premium */}
          {planInfo.isPremium && !subscription?.cancel_at_period_end && (
            <section className={styles.card}>
              <h2 className={styles.cardTitle}>⚙️ Gerenciar Assinatura</h2>
              <p className={styles.cardDesc}>
                Ao cancelar, você continuará com acesso até o fim do período já pago.
              </p>

              {cancelDate && (
                <div className={styles.successMsg}>
                  ✅ Assinatura cancelada com sucesso! Seu acesso continua até {formatDate(cancelDate)}.
                </div>
              )}

              {error && <div className={styles.errorMsg}>⚠️ {error}</div>}

              {!showCancelConfirm ? (
                <button
                  id="cancel-subscription-btn"
                  className={styles.cancelBtn}
                  onClick={() => setShowCancelConfirm(true)}
                >
                  Cancelar para o próximo ciclo
                </button>
              ) : (
                <div className={styles.confirmBox}>
                  <p className={styles.confirmQuestion}>
                    Tem certeza? Você perderá o acesso premium ao fim do período atual.
                  </p>
                  <div className={styles.confirmActions}>
                    <button
                      className={styles.confirmYes}
                      onClick={confirmCancel}
                      disabled={isCancelling}
                    >
                      {isCancelling ? 'Cancelando...' : 'Sim, cancelar'}
                    </button>
                    <button
                      className={styles.confirmNo}
                      onClick={() => setShowCancelConfirm(false)}
                    >
                      Não, manter
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Card: Mudar de plano */}
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>🚀 {planInfo.isPremium ? 'Mudar de Plano' : 'Assinar um Plano'}</h2>
            <p className={styles.cardDesc}>
              {planInfo.isPremium
                ? 'Faça upgrade ou downgrade do seu plano atual.'
                : 'Escolha um plano e ative a automação em nuvem.'}
            </p>

            {error && <div className={styles.errorMsg}>⚠️ {error}</div>}

            <div className={styles.plansGrid}>
              {PLANS.map(plan => {
                const isCurrent = planName === plan.name;
                return (
                  <div
                    key={plan.name}
                    className={`${styles.planCard} ${isCurrent ? styles.planCardCurrent : ''}`}
                    style={{ '--plan-color': plan.color } as React.CSSProperties}
                  >
                    {isCurrent ? (
                      <div className={styles.currentBadge}>✓ Plano Atual</div>
                    ) : plan.popular ? (
                      <div className={styles.popularBadge}>Mais Popular</div>
                    ) : null}
                    <h3 className={styles.planName} style={{ color: plan.color }}>{plan.name}</h3>
                    <div className={styles.planPrice}>{plan.price}</div>
                    <ul className={styles.featureList}>
                      {plan.features.map(f => (
                        <li key={f}>✓ {f}</li>
                      ))}
                    </ul>
                    <button
                      id={`plan-btn-${plan.name.toLowerCase()}`}
                      className={`${styles.planBtn} ${isCurrent ? styles.planBtnCurrent : ''}`}
                      onClick={() => !isCurrent && plan.priceId && handleChangePlan(plan.priceId)}
                      disabled={isCurrent || isSubscribing !== null}
                    >
                      {isSubscribing === plan.priceId
                        ? 'Processando...'
                        : isCurrent
                        ? 'Plano Ativo'
                        : 'Selecionar Plano'}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

        </div>
      </main>
    </div>
  );
}
