import { useState, useEffect, useCallback } from "react";
import { useAuthViewModel } from "@/src/frontend/views/providers/AuthContext";
import { useAccountsViewModel } from "@/src/frontend/viewmodels/useAccountsViewModel";

export function useHomeViewModel() {
  const {
    user,
    session,
    planInfo,
    isLoading: isAuthLoading,
  } = useAuthViewModel();
  const {
    accounts,
    isLoadingAccounts,
    addAccount,
    editAccount,
    deleteAccount,
  } = useAccountsViewModel(user?.id);

  const [isGenerating, setIsGenerating] = useState(false);
  const [accountErrorStatus, setAccountErrorStatus] = useState<
    Record<string, boolean>
  >({});

  const accountCount = accounts.length;
  const canAddAccount = accountCount < planInfo.maxAccounts;

  // Busca o status has_error de cada conta no banco
  const fetchAccountStatus = useCallback(async () => {
    if (!session?.access_token || !planInfo.isPremium) return;
    try {
      const res = await fetch("/api/cloud/account", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAccountErrorStatus(data.status || {});
      }
    } catch (e) {
      console.error("Failed to fetch account status:", e);
    }
  }, [session?.access_token, planInfo.isPremium]);

  useEffect(() => {
    fetchAccountStatus();
  }, [fetchAccountStatus]);

  // Delete: remove do LocalStorage e do banco
  const handleDeleteAccount = async (id: string) => {
    await deleteAccount(id);

    if (session?.access_token && planInfo.isPremium) {
      try {
        await fetch("/api/cloud/account", {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ accountId: id }),
        });
      } catch (e) {
        console.error("Failed to delete account from cloud:", e);
      }
    }

    setAccountErrorStatus((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleSyncToCloud = async () => {
    if (!user || accounts.length === 0 || !planInfo.isPremium) return;
    setIsGenerating(true);

    try {
      const res = await fetch("/api/cloud/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ accounts }),
      });

      if (res.ok) {
        alert(
          "Contas sincronizadas com a nuvem com sucesso! A automação rodará automaticamente no próximo ciclo.",
        );
        await fetchAccountStatus();
      } else {
        const errData = await res.json();
        alert(
          errData.detail || errData.error || "Falha ao sincronizar contas.",
        );
      }
    } catch (err) {
      console.error(err);
      alert("Erro ao sincronizar com a nuvem.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubscribe = async (priceId: string) => {
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ priceId }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert("Failed to initialize checkout.");
      }
    } catch (e) {
      console.error(e);
      alert("Checkout error");
    }
  };

  return {
    user,
    accounts,
    planInfo,
    isAuthLoading,
    isLoadingAccounts,
    isGenerating,
    accountCount,
    canAddAccount,
    accountErrorStatus,
    addAccount,
    editAccount,
    deleteAccount: handleDeleteAccount,
    handleSyncToCloud,
    handleSubscribe,
  };
}
