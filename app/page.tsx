"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/src/frontend/views/components/Navbar";
import AccountModal from "@/src/frontend/views/components/AccountModal";
import PricingModal from "@/src/frontend/views/components/PricingModal";
import styles from "./page.module.css";
import { useHomeViewModel } from "@/src/frontend/viewmodels/useHomeViewModel";

const REVENUE_PER_ACCOUNT = 400;

export default function HomePage() {
  const {
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
    deleteAccount,
    handleSyncToCloud,
    handleSubscribe,
  } = useHomeViewModel();

  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | undefined>(
    undefined,
  );
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [showPricingModal, setShowPricingModal] = useState(false);

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.push("/login");
    }
  }, [user, isAuthLoading, router]);

  if (isAuthLoading || !user) return null;

  const monthlyRevenue = accountCount * REVENUE_PER_ACCOUNT;

  const openAdd = () => {
    setEditingAccount(undefined);
    setShowModal(true);
  };

  const openEdit = (acc: Account) => {
    setEditingAccount(acc);
    setShowModal(true);
  };

  const confirmDelete = async (id: string) => {
    await deleteAccount(id);
    setPendingDeleteId(null);
  };

  const handleModalClose = () => {
    setShowModal(false);
    setEditingAccount(undefined);
  };

  return (
    <div className={styles.wrapper}>
      <Navbar />
      <main className={styles.main}>
        <div className={styles.grid}>
          {/* Left Panel – Accounts */}
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div className={styles.panelIcon}>🗂️</div>
              <div>
                <h2 className={styles.panelTitle}>My Accounts</h2>
                <p className={styles.panelSubtitle}>
                  Stored credentials vault (Local)
                </p>
              </div>
            </div>

            {/* Stats row */}
            <div className={styles.statsRow}>
              <div className={styles.statCard}>
                <span className={styles.statNumber}>
                  {accountCount}
                  {planInfo.maxAccounts < Infinity && planInfo.maxAccounts > 0
                    ? ` / ${planInfo.maxAccounts}`
                    : planInfo.maxAccounts === 0
                      ? " / 0"
                      : ""}
                </span>
                <span className={styles.statLabel}>
                  {accountCount === 1 ? "Account" : "Accounts"}
                </span>
              </div>
              <div className={styles.statCard}>
                <span
                  className={styles.statNumber}
                  style={{ color: "#22c55e" }}
                >
                  ${monthlyRevenue.toLocaleString()}
                </span>
                <span className={styles.statLabel}>/ month</span>
              </div>
            </div>

            {!isLoadingAccounts && accountCount > 0 && (
              <ul className={styles.accountList}>
                {accounts.map((acc) => {
                  const hasError = accountErrorStatus[acc.id] === true;
                  return (
                    <li
                      key={acc.id}
                      className={`${styles.accountItem} ${hasError ? styles.accountItemError : ""}`}
                    >
                      <div className={styles.accountAvatar}>
                        {acc.name.charAt(0).toUpperCase()}
                      </div>
                      <div className={styles.accountInfo}>
                        <p className={styles.accountName}>{acc.name}</p>
                        <p className={styles.accountPass}>••••••••</p>
                      </div>
                      {hasError && (
                        <p className={styles.errorMsg}>
                          Login ou senha incorretos.
                        </p>
                      )}
                      {pendingDeleteId === acc.id ? (
                        <div className={styles.confirmActions}>
                          <span className={styles.confirmText}>Delete?</span>
                          <button
                            className={styles.confirmYes}
                            onClick={() => confirmDelete(acc.id)}
                          >
                            Yes
                          </button>
                          <button
                            className={styles.confirmNo}
                            onClick={() => setPendingDeleteId(null)}
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <div className={styles.accountActions}>
                          <button
                            className={styles.editBtn}
                            onClick={() => openEdit(acc)}
                            title="Edit account"
                          >
                            ✏️
                          </button>
                          <button
                            className={styles.deleteBtn}
                            onClick={() => setPendingDeleteId(acc.id)}
                            title="Delete account"
                          >
                            🗑️
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            {!isLoadingAccounts && accountCount === 0 && (
              <p className={styles.emptyMsg}>
                No accounts yet. Create your first one below.
              </p>
            )}

            <button
              id="open-account-modal"
              className={styles.addBtn}
              onClick={openAdd}
              disabled={!canAddAccount}
              style={{
                opacity: canAddAccount ? 1 : 0.5,
                cursor: canAddAccount ? "pointer" : "not-allowed",
              }}
              title={
                !canAddAccount
                  ? "Account limit reached. Please upgrade your plan."
                  : "Add a new account"
              }
            >
              <span>+</span> Add Account
            </button>
          </section>

          {/* Right Panel – Cloud Automation */}
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div className={styles.panelIcon}>☁️</div>
              <div>
                <h2 className={styles.panelTitle}>Cloud Automation</h2>
                <p className={styles.panelSubtitle}>
                  Automação rodando na nuvem
                </p>
              </div>
            </div>
            {planInfo.isPremium ? (
              <div style={{ textAlign: "center", padding: "2rem 1rem" }}>
                <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🚀</div>
                <h3 style={{ marginBottom: "0.5rem", color: "#22c55e" }}>
                  Tudo Pronto!
                </h3>
                <p
                  style={{
                    color: "#888",
                    marginBottom: "1.5rem",
                    fontSize: "0.9rem",
                  }}
                >
                  Sua assinatura está ativa. As contas cadastradas acima estão
                  sincronizadas e a automação rodará automaticamente na nuvem
                  todos os dias. Você não precisa baixar nada!
                </p>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "1rem",
                  }}
                >
                  <button
                    onClick={() => {
                      if (!isGenerating && accountCount > 0) {
                        handleSyncToCloud();
                      }
                    }}
                    disabled={isGenerating || accountCount === 0}
                    style={{
                      backgroundColor: "#3b82f6",
                      color: "white",
                      border: "none",
                      padding: "0.75rem 1.5rem",
                      borderRadius: "0.5rem",
                      fontWeight: "bold",
                      cursor:
                        isGenerating || accountCount === 0
                          ? "not-allowed"
                          : "pointer",
                      opacity: isGenerating || accountCount === 0 ? 0.5 : 1,
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                    }}
                  >
                    ☁️{" "}
                    {isGenerating
                      ? "Sincronizando..."
                      : "Sincronizar Contas Agora"}
                  </button>
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      padding: "0.5rem 1rem",
                      backgroundColor: "rgba(34, 197, 94, 0.1)",
                      color: "#22c55e",
                      borderRadius: "9999px",
                      fontWeight: "bold",
                    }}
                  >
                    <span
                      style={{
                        width: "8px",
                        height: "8px",
                        backgroundColor: "#22c55e",
                        borderRadius: "50%",
                        display: "inline-block",
                      }}
                    ></span>
                    Serviço Ativo
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "2rem 1rem" }}>
                <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🔒</div>
                <h3 style={{ marginBottom: "0.5rem" }}>Recurso Premium</h3>
                <p
                  style={{
                    color: "#888",
                    marginBottom: "1.5rem",
                    fontSize: "0.9rem",
                  }}
                >
                  Assine o plano premium para ativar a automação em nuvem 100%
                  automática para todas as suas contas.
                </p>
                <button
                  className={styles.generateBtn}
                  onClick={() => setShowPricingModal(true)}
                  style={{ backgroundColor: "#22c55e", color: "#fff" }}
                >
                  Ver Planos Premium
                </button>
              </div>
            )}
          </section>
        </div>
      </main>

      {showModal && (
        <AccountModal
          onClose={handleModalClose}
          account={editingAccount}
          canAddAccount={canAddAccount}
          onAddAccount={addAccount}
          onEditAccount={editAccount}
        />
      )}

      {showPricingModal && (
        <PricingModal
          onClose={() => setShowPricingModal(false)}
          onSubscribe={handleSubscribe}
        />
      )}
    </div>
  );
}
