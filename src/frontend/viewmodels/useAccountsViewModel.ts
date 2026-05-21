import { useState, useEffect, useCallback } from 'react';
import { Account } from '@/src/frontend/models/types';

export function useAccountsViewModel(userId: string | undefined) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const getStorageKey = useCallback(() => {
    return userId ? `tlxauto_accounts_${userId}` : null;
  }, [userId]);

  // Load from local storage whenever userId changes
  useEffect(() => {
    const key = getStorageKey();
    if (!key) {
      setAccounts([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const stored = localStorage.getItem(key);
    if (stored) {
      try {
        setAccounts(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to parse accounts from local storage', e);
        setAccounts([]);
      }
    } else {
      setAccounts([]);
    }
    setIsLoading(false);
  }, [getStorageKey]);

  // Save to local storage whenever accounts change
  const saveAccounts = useCallback((newAccounts: Account[]) => {
    const key = getStorageKey();
    setAccounts(newAccounts);
    if (key) {
      localStorage.setItem(key, JSON.stringify(newAccounts));
    }
  }, [getStorageKey]);

  const addAccount = async (name: string, password?: string) => {
    try {
      const newAccount: Account = {
        id: crypto.randomUUID(),
        name,
        password,
        created_at: new Date().toISOString()
      };
      saveAccounts([...accounts, newAccount]);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const editAccount = async (id: string, name: string, password?: string) => {
    try {
      const newAccounts = accounts.map(acc => 
        acc.id === id ? { ...acc, name, password } : acc
      );
      saveAccounts(newAccounts);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const deleteAccount = async (id: string) => {
    try {
      const newAccounts = accounts.filter(acc => acc.id !== id);
      saveAccounts(newAccounts);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const replaceAccounts = (newAccounts: Account[]) => {
    const key = getStorageKey();
    setAccounts(newAccounts);
    if (key) {
      localStorage.setItem(key, JSON.stringify(newAccounts));
    }
  };

  return {
    accounts,
    isLoadingAccounts: isLoading,
    addAccount,
    editAccount,
    deleteAccount,
    replaceAccounts,
  };
}
