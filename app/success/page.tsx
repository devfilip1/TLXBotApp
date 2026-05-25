"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthViewModel } from "@/src/frontend/views/providers/AuthContext";
import styles from "../page.module.css";

function SuccessPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const { session, isLoading, refreshSubscription } = useAuthViewModel();
  const [countdown, setCountdown] = useState(5);
  const [hasSynced, setHasSynced] = useState(false);
  const [syncAttempts, setSyncAttempts] = useState(0);
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionId && session?.access_token && !hasSynced && syncAttempts < 3) {
      fetch("/api/stripe/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ sessionId }),
      })
        .then(async (res) => {
          if (!res.ok) {
            const data = await res.json().catch(() => null);
            const message = data?.error || "Sync request failed";
            throw new Error(message);
          }
          setHasSynced(true);
          await refreshSubscription();
        })
        .catch((error) => {
          console.error("Success sync failed:", error);
          setSyncError(error.message);
          setSyncAttempts((prev) => prev + 1);
        });
    }
  }, [
    sessionId,
    session?.access_token,
    hasSynced,
    refreshSubscription,
    syncAttempts,
  ]);

  useEffect(() => {
    if (!isLoading && !session) {
      const fallbackRedirect = setTimeout(() => {
        router.push("/login");
      }, 3000);
      return () => clearTimeout(fallbackRedirect);
    }

    refreshSubscription();

    const interval = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    // Poll for subscription updates every 1.5s
    const pollInterval = setInterval(() => {
      refreshSubscription();
    }, 1500);

    const timeout = setTimeout(() => {
      router.push("/");
    }, 5000);

    return () => {
      clearInterval(interval);
      clearInterval(pollInterval);
      clearTimeout(timeout);
    };
  }, [router, refreshSubscription, isLoading, session]);

  if (!isLoading && !session) {
    return (
      <div
        className={styles.wrapper}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          className={styles.panel}
          style={{ textAlign: "center", padding: "3rem" }}
        >
          <h1
            style={{ color: "#f59e0b", fontSize: "2rem", marginBottom: "1rem" }}
          >
            Sessão não encontrada
          </h1>
          <p>
            Não conseguimos identificar sua sessão de login. Você será
            redirecionado para o login em alguns segundos.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={styles.wrapper}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        className={styles.panel}
        style={{ textAlign: "center", padding: "3rem" }}
      >
        <h1
          style={{ color: "#22c55e", fontSize: "2rem", marginBottom: "1rem" }}
        >
          Payment Successful!
        </h1>
        <p>Thank you for subscribing to Premium.</p>

        <p style={{ marginTop: "2rem" }}>
          Redirecting to dashboard in {countdown} seconds...
        </p>
        {syncError && (
          <p style={{ marginTop: "1rem", color: "#f87171" }}>
            Erro ao sincronizar assinatura: {syncError}
          </p>
        )}
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SuccessPageContent />
    </Suspense>
  );
}
