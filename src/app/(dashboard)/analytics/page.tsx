"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/stat-card";
import { formatCurrency } from "@/lib/currency";
import { Globe, Wallet, TrendingUp, CalendarClock } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

interface AnalyticsData {
  totalDomains: number;
  totalSpent: number;
  averageRenewalCost: number;
  upcomingCost: number;
  monthlySpending: { month: string; total: number }[];
  categoryBreakdown: { category: string; count: number }[];
  mostExpensive: { name: string; price: number; category: string }[];
  totalPayments: number;
}

const CATEGORY_COLORS = ["#6366F1", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#06B6D4"];

export default function AnalyticsPage() {
  const { data: session } = useSession();
  const currency = session?.user?.currency ?? "INR";
  const [data, setData] = useState<AnalyticsData | null>(null);

  useEffect(() => {
    fetch("/api/analytics")
      .then((r) => r.json())
      .then(setData);
  }, []);

  if (!data) {
    return <div className="flex items-center justify-center h-96 text-slate-400 text-sm">Loading analytics...</div>;
  }

  const isDark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");
  const axisColor = isDark ? "#64748b" : "#94a3b8";
  const gridColor = isDark ? "#1e293b" : "#f1f5f9";

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Analytics</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Insights into your domain portfolio and spending.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Domains" value={data.totalDomains} icon={Globe} accent="indigo" />
        <StatCard label="Total Spent" value={formatCurrency(data.totalSpent, currency)} icon={Wallet} accent="emerald" hint={`${data.totalPayments} renewals`} />
        <StatCard label="Avg. Renewal Cost" value={formatCurrency(data.averageRenewalCost, currency)} icon={TrendingUp} accent="indigo" />
        <StatCard label="Upcoming Costs" value={formatCurrency(data.upcomingCost, currency)} icon={CalendarClock} accent="amber" hint="Next 60 days" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Monthly Renewal Spending (last 12 months)</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.monthlySpending}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: axisColor }} axisLine={{ stroke: gridColor }} tickLine={false} interval={1} />
              <YAxis tick={{ fontSize: 11, fill: axisColor }} axisLine={false} tickLine={false} width={40} />
              <Tooltip
                formatter={(v: number) => formatCurrency(v, currency)}
                contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
              />
              <Bar dataKey="total" fill="#6366F1" radius={[6, 6, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Domains by Category</h3>
          {data.categoryBreakdown.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">No domains yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={data.categoryBreakdown}
                  dataKey="count"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                >
                  {data.categoryBreakdown.map((_, i) => (
                    <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <Card className="p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Most Expensive Domains</h3>
        {data.mostExpensive.length === 0 ? (
          <p className="text-sm text-slate-400">No domains yet.</p>
        ) : (
          <div className="space-y-3">
            {data.mostExpensive.map((d, i) => (
              <div key={d.name} className="flex items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-muted dark:bg-slate-800 text-xs font-semibold text-slate-500">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-foreground truncate">{d.name}</span>
                    <span className="text-sm font-semibold text-foreground shrink-0">{formatCurrency(d.price, currency)}</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-surface-muted dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-brand rounded-full"
                      style={{ width: `${(d.price / data.mostExpensive[0].price) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
