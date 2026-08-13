"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useData } from "@/components/data-provider";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { daysRemaining, getDomainStatus, daysRemainingLabel } from "@/lib/domain-utils";
import { formatCurrency } from "@/lib/currency";
import {
  Globe,
  Users,
  ShieldCheck,
  AlarmClock,
  ShieldX,
  Wallet,
  CalendarClock,
  Plus,
  ArrowRight,
  UserPlus,
  Pencil,
  Trash2,
  RefreshCw,
  Receipt,
  UserMinus,
  Download,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { RenewModal } from "@/components/renew-modal";
import { DomainFormModal } from "@/components/domain-form-modal";
import { CustomerFormModal } from "@/components/customer-form-modal";
import type { ActivityLog, Domain } from "@/lib/schema";
import { formatDistanceToNow, parseISO } from "date-fns";

interface DashboardStats {
  totalDomains: number;
  totalCustomers: number;
  activeDomains: number;
  expiringSoon: number;
  expiredDomains: number;
  revenue: number;
  renewalsThisMonth: number;
  renewalsThisMonthRevenue: number;
  multiDomainCustomers: { id: string; fullName: string; domainCount: number }[];
}

const ACTIVITY_META: Record<string, { icon: LucideIcon; accent: string }> = {
  customer_created: { icon: UserPlus, accent: "text-emerald-600 dark:text-emerald-400" },
  customer_updated: { icon: Pencil, accent: "text-slate-500 dark:text-slate-400" },
  customer_deleted: { icon: UserMinus, accent: "text-red-600 dark:text-red-400" },
  domain_created: { icon: Globe, accent: "text-brand" },
  domain_updated: { icon: Pencil, accent: "text-slate-500 dark:text-slate-400" },
  domain_deleted: { icon: Trash2, accent: "text-red-600 dark:text-red-400" },
  domain_renewed: { icon: RefreshCw, accent: "text-emerald-600 dark:text-emerald-400" },
  payment_recorded: { icon: Receipt, accent: "text-amber-600 dark:text-amber-400" },
};

export default function DashboardPage() {
  const { data: session } = useSession();
  const { domains, loading } = useData();
  const currency = session?.user?.currency ?? "INR";
  const [renewTarget, setRenewTarget] = useState<Domain | null>(null);
  const [addDomainOpen, setAddDomainOpen] = useState(false);
  const [addCustomerOpen, setAddCustomerOpen] = useState(false);

  // Dashboard headline numbers come from one aggregate-SQL endpoint
  // (COUNT/SUM/GROUP BY server-side) rather than reducing the full
  // domains/payments arrays in the browser on every load - see
  // /api/dashboard-stats for the query set this replaces.
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    const [statsRes, activityRes] = await Promise.all([fetch("/api/dashboard-stats"), fetch("/api/activity?limit=8")]);
    if (statsRes.ok) setStats(await statsRes.json());
    if (activityRes.ok) setActivity((await activityRes.json()).activity);
    setStatsLoading(false);
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const expiringSoonList = useMemo(() => {
    return [...domains]
      .filter((d) => daysRemaining(d.expiryDate) <= 30)
      .sort((a, b) => daysRemaining(a.expiryDate) - daysRemaining(b.expiryDate))
      .slice(0, 6);
  }, [domains]);

  if (loading || statsLoading || !stats) {
    return (
      <div className="flex items-center justify-center h-96 text-slate-400 text-sm">Loading your dashboard...</div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Welcome back, {session?.user?.name?.split(" ")[0] ?? "there"}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Here&apos;s the current state of your domain portfolio.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setAddCustomerOpen(true)}>
            <UserPlus className="h-4 w-4" /> Add Customer
          </Button>
          <Button onClick={() => setAddDomainOpen(true)}>
            <Plus className="h-4 w-4" /> Add Domain
          </Button>
        </div>
      </div>

      {stats.totalDomains === 0 ? (
        <EmptyState onAdd={() => setAddDomainOpen(true)} />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <StatCard label="Total Domains" value={stats.totalDomains} icon={Globe} accent="indigo" />
            <StatCard label="Customers" value={stats.totalCustomers} icon={Users} accent="indigo" />
            <StatCard label="Active" value={stats.activeDomains} icon={ShieldCheck} accent="emerald" />
            <StatCard label="Expiring Soon" value={stats.expiringSoon} icon={AlarmClock} accent="amber" hint="Within 30 days" />
            <StatCard label="Expired" value={stats.expiredDomains} icon={ShieldX} accent="red" />
            <StatCard label="Total Revenue" value={formatCurrency(stats.revenue, currency)} icon={Wallet} accent="indigo" />
          </div>

          <div className="grid lg:grid-cols-3 gap-4">
            <Card className="p-5 lg:col-span-1">
              <div className="flex items-center gap-2 mb-1">
                <CalendarClock className="h-4 w-4 text-slate-400" />
                <h3 className="text-sm font-semibold text-foreground">This Month</h3>
              </div>
              <p className="text-2xl font-semibold text-foreground mt-2">{stats.renewalsThisMonth}</p>
              <p className="text-xs text-slate-400 mt-0.5">renewals · {formatCurrency(stats.renewalsThisMonthRevenue, currency)} collected</p>
            </Card>

            <Card className="p-5 lg:col-span-2">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-foreground">Top Customers by Domains</h3>
                <Link href="/customers" className="text-xs text-brand font-medium hover:underline flex items-center gap-1">
                  View all <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              {stats.multiDomainCustomers.length === 0 ? (
                <p className="text-sm text-slate-400">No customer owns more than one domain yet.</p>
              ) : (
                <div className="space-y-2.5">
                  {stats.multiDomainCustomers.map((c) => (
                    <Link
                      key={c.id}
                      href={`/customers/${c.id}`}
                      className="flex items-center justify-between text-sm hover:text-brand transition-smooth"
                    >
                      <span className="text-foreground font-medium">{c.fullName}</span>
                      <span className="text-slate-400">{c.domainCount} domains</span>
                    </Link>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">Expiring Soon</h2>
              <Link href="/domains" className="text-sm text-brand font-medium hover:underline flex items-center gap-1">
                View all domains <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {expiringSoonList.length === 0 ? (
              <Card className="p-8 text-center text-sm text-slate-400">
                Nothing needs attention right now — all domains are safely renewed. 🎉
              </Card>
            ) : (
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {expiringSoonList.map((d) => {
                  const days = daysRemaining(d.expiryDate);
                  const status = getDomainStatus(days);
                  return (
                    <Card key={d.id} className="p-5 flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <Link href={`/domains/${d.id}`} className="font-semibold text-foreground truncate hover:text-brand block">
                            {d.name}
                          </Link>
                          <p className="text-xs text-slate-400 mt-0.5">{d.registrar}</p>
                        </div>
                        <StatusBadge status={status} />
                      </div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">{daysRemainingLabel(days)}</div>
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                        <span className="text-sm font-semibold text-foreground">
                          {formatCurrency(d.renewalPrice, currency)}
                        </span>
                        <Button size="sm" onClick={() => setRenewTarget(d)}>
                          Renew Now
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">Recent Activity</h2>
              <a href="/api/export/domains" className="text-sm text-brand font-medium hover:underline flex items-center gap-1">
                <Download className="h-3.5 w-3.5" /> Export domains
              </a>
            </div>
            <Card className="divide-y divide-slate-100 dark:divide-slate-800">
              {activity.length === 0 ? (
                <p className="p-6 text-sm text-slate-400 text-center">No activity recorded yet.</p>
              ) : (
                activity.map((a) => {
                  const meta = ACTIVITY_META[a.type] ?? { icon: Globe, accent: "text-slate-400" };
                  const Icon = meta.icon;
                  return (
                    <div key={a.id} className="flex items-center gap-3 px-5 py-3">
                      <Icon className={`h-4 w-4 shrink-0 ${meta.accent}`} />
                      <p className="text-sm text-foreground flex-1 min-w-0 truncate">{a.message}</p>
                      <span className="text-xs text-slate-400 shrink-0">
                        {formatDistanceToNow(parseISO(a.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                  );
                })
              )}
            </Card>
          </div>
        </>
      )}

      <RenewModal
        domain={renewTarget}
        open={!!renewTarget}
        onClose={() => {
          setRenewTarget(null);
          loadStats();
        }}
        currency={currency}
      />
      <DomainFormModal
        open={addDomainOpen}
        onClose={() => {
          setAddDomainOpen(false);
          loadStats();
        }}
      />
      <CustomerFormModal open={addCustomerOpen} onClose={() => setAddCustomerOpen(false)} onSaved={loadStats} />
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <Card className="p-12 text-center">
      <div className="mx-auto h-14 w-14 rounded-2xl bg-brand/10 flex items-center justify-center">
        <Globe className="h-7 w-7 text-brand" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-foreground">No domains yet</h3>
      <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
        Add your first domain to start tracking expiry dates and never miss a renewal again.
      </p>
      <Button className="mt-6" onClick={onAdd}>
        <Plus className="h-4 w-4" /> Add your first domain
      </Button>
    </Card>
  );
}
