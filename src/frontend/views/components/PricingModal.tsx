'use client';

import { useState } from 'react';
import styles from './PricingModal.module.css';

interface Props {
  onClose: () => void;
  onSubscribe: (priceId: string) => void;
}

export default function PricingModal({ onClose, onSubscribe }: Props) {
  const [loadingPrice, setLoadingPrice] = useState<string | null>(null);

  const handlePlanClick = (priceId: string | undefined) => {
    if (!priceId) {
      alert('The Stripe Price ID for this plan is missing in .env.local');
      return;
    }
    setLoadingPrice(priceId);
    onSubscribe(priceId);
  };

  const plans = [
    {
      name: 'Basic',
      price: '$9/mo',
      description: 'Ideal para iniciantes e pequenos projetos pessoais.',
      features: ['Até 5 apps por mês', 'Templates básicos', 'Suporte da comunidade'],
      priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_BASIC
    },
    {
      name: 'Pro',
      price: '$29/mo',
      description: 'Perfeito para profissionais criando automações escaláveis.',
      features: ['Apps ilimitados', 'Templates premium', 'Suporte prioritário por email', 'Marca customizada'],
      priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO,
      popular: true
    },
    {
      name: 'Elite',
      price: '$99/mo',
      description: 'Para agências e operações automatizadas em larga escala.',
      features: ['Tudo do plano Pro', 'Gerente de conta dedicado', 'Acesso VIP via API', 'Garantia de SLA e Uptime'],
      priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ELITE
    }
  ];

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Escolha seu plano</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>
        <p className={styles.subtitle}>Desbloqueie o Gerador de Apps e leve sua automação para o próximo nível.</p>
        
        <div className={styles.plansContainer}>
          {plans.map(plan => (
            <div key={plan.name} className={`${styles.planCard} ${plan.popular ? styles.popular : ''}`}>
              {plan.popular && <div className={styles.popularBadge}>Mais Popular</div>}
              <h3 className={styles.planName}>{plan.name}</h3>
              <div className={styles.planPrice}>{plan.price}</div>
              <p className={styles.planDesc}>{plan.description}</p>
              <ul className={styles.featureList}>
                {plan.features.map(feat => (
                  <li key={feat}>✓ {feat}</li>
                ))}
              </ul>
              <button
                className={styles.subscribeBtn}
                onClick={() => handlePlanClick(plan.priceId)}
                disabled={loadingPrice !== null}
              >
                {loadingPrice === plan.priceId ? 'Processando...' : 'Assinar Plano'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
