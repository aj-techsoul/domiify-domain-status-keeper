"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { Domain, Payment, Notification } from "@/lib/schema";

interface DataContextValue {
  domains: Domain[];
  notifications: Notification[];
  payments: Payment[];
  loading: boolean;
  refreshDomains: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  refreshPayments: () => Promise<void>;
  refreshAll: () => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshDomains = useCallback(async () => {
    // `/api/domains` is now paginated (Feature 15 - perf) for the dedicated
    // Domains list page, which fetches page-by-page on its own. This shared
    // context is consumed by pages that still need the *whole* set at once
    // (dashboard "expiring soon", calendar, analytics, renew-modal lookups),
    // so it opts into the `all=true` escape hatch rather than only getting
    // page 1 of 20.
    const res = await fetch("/api/domains?all=true");
    if (res.ok) {
      const data = await res.json();
      setDomains(data.domains);
    }
  }, []);

  const refreshNotifications = useCallback(async () => {
    const res = await fetch("/api/notifications");
    if (res.ok) {
      const data = await res.json();
      setNotifications(data.notifications);
    }
  }, []);

  const refreshPayments = useCallback(async () => {
    // Same reasoning as refreshDomains: `/api/payments` is now paginated for
    // its own dedicated list page, so the shared context asks for the full
    // set explicitly (used by analytics, dashboard, and CSV-adjacent views).
    const res = await fetch("/api/payments?all=true");
    if (res.ok) {
      const data = await res.json();
      setPayments(data.payments);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([refreshDomains(), refreshNotifications(), refreshPayments()]);
  }, [refreshDomains, refreshNotifications, refreshPayments]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await refreshAll();
      setLoading(false);
    })();
    // Poll for new reminders every 2 minutes so notifications stay current
    // during a long session without requiring a manual refresh.
    const interval = setInterval(() => {
      refreshNotifications();
    }, 120_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <DataContext.Provider
      value={{ domains, notifications, payments, loading, refreshDomains, refreshNotifications, refreshPayments, refreshAll }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}
