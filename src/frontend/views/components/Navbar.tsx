'use client';

import { useRouter } from 'next/navigation';
import { useAuthViewModel } from '@/src/frontend/views/providers/AuthContext';
import { getPlanName } from '@/src/frontend/viewmodels/useProfileViewModel';
import styles from './Navbar.module.css';

export default function Navbar() {
  const { user, subscription, planInfo, logout } = useAuthViewModel();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const planName = getPlanName(subscription?.price_id, planInfo.isPremium);
  const avatarLetter = (user?.user_metadata?.name || user?.email || 'U').charAt(0).toUpperCase();

  const planColors: Record<string, string> = {
    Free: styles.badgeFree,
    Basic: styles.badgeBasic,
    Pro: styles.badgePro,
    Elite: styles.badgeElite,
  };

  return (
    <nav className={styles.navbar}>
      <div className={styles.logo}>
        <span className={styles.logoIcon}>⬡</span>
        <span className={styles.logoText}>TLXBot</span>
      </div>

      <div className={styles.right}>
        {user && (
          <>
            {/* Plan badge */}
            <span className={`${styles.planBadge} ${planColors[planName] || styles.badgeFree}`}>
              {planName === 'Elite' ? '★' : planName === 'Pro' ? '✦' : '○'} {planName}
            </span>

            {/* Avatar button → profile page */}
            <button
              id="profile-avatar-btn"
              className={styles.avatarBtn}
              onClick={() => router.push('/profile')}
              title="Meu Perfil"
            >
              {avatarLetter}
            </button>

            <button className={styles.logoutBtn} onClick={handleLogout}>
              Logout
            </button>
          </>
        )}
      </div>
    </nav>
  );
}
