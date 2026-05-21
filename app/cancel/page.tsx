'use client';

import { useRouter } from 'next/navigation';
import styles from '../page.module.css';

export default function CancelPage() {
  const router = useRouter();

  return (
    <div className={styles.wrapper} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className={styles.panel} style={{ textAlign: 'center', padding: '3rem' }}>
        <h1 style={{ color: '#ef4444', fontSize: '2rem', marginBottom: '1rem' }}>Payment Cancelled</h1>
        <p>Your checkout process was cancelled. You have not been charged.</p>
        <button 
          className={styles.addBtn} 
          style={{ marginTop: '2rem', display: 'inline-block' }} 
          onClick={() => router.push('/')}
        >
          Return to Dashboard
        </button>
      </div>
    </div>
  );
}
