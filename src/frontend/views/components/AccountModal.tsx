'use client';

import { useState, useEffect } from 'react';
import { Account } from '@/src/frontend/models/types';
import styles from './AccountModal.module.css';

interface Props {
  onClose: () => void;
  account?: Account; // if provided → edit mode
  canAddAccount: boolean;
  onAddAccount: (name: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  onEditAccount: (id: string, name: string, password?: string) => Promise<{ success: boolean; error?: string }>;
}

export default function AccountModal({ onClose, account, canAddAccount, onAddAccount, onEditAccount }: Props) {
  const isEdit = !!account;

  const [name, setName] = useState(account?.name ?? '');
  const [password, setPassword] = useState(account?.password ?? '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Sync if account prop changes
  useEffect(() => {
    setName(account?.name ?? '');
    setPassword(account?.password ?? '');
  }, [account]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEdit && !canAddAccount) {
      setError('Account limit reached. Please upgrade your plan.');
      return;
    }
    if (!name.trim() || !password.trim()) {
      setError('Both fields are required.');
      return;
    }
    setLoading(true);
    let res: { success: boolean; error?: string };
    if (isEdit && account) {
      res = await onEditAccount(account.id, name.trim(), password);
    } else {
      res = await onAddAccount(name.trim(), password);
    }
    setLoading(false);
    if (res.success) {
      onClose();
    } else {
      setError(res.error || 'An error occurred. Please try again.');
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>{isEdit ? 'Edit Account' : 'New Account'}</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>
        <p className={styles.subtitle}>
          {isEdit ? 'Update your account details' : 'Add a new account to your vault'}
        </p>
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label}>Account Name</label>
            <input
              className={styles.input}
              type="text"
              placeholder="e.g. GitHub, AWS, Netflix"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Password</label>
            <input
              className={styles.input}
              type="password"
              placeholder="Enter account password"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>
          {error && <p className={styles.error}>{error}</p>}
          <div className={styles.actions}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>Cancel</button>
            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
