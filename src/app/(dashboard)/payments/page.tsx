"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { formatCurrency } from "@/lib/currency";
import { formatDate, PAYMENT_METHODS } from "@/lib/domain-utils";
import { useDebouncedValue } from "@/lib/hooks";
import { Search, Receipt, Download } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Payment } from "@/lib/schema";

export default function PaymentsPage() {
  const { data: session } = useSession();
  const currency = session?.user?.currency ?? "INR";

  // Own paginated/searchable fetch against /api/payments (Feature 15 -
  // performance), same reasoning as the Domains and Customers pages: only
  // the current page of transactions is ever transferred, and typing in
  // the search box is debounced instead of firing a request per keystroke.
  const [rows, setRows] = useState<Payment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 300);
  const [method, setMethod] = useState("All");
  const [status, setStatus] = useState("All");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (debouncedQuery) params.set("q", debouncedQuery);
    if (method !== "All") params.set("method", method);
    if (status !== "All") params.set("status", status);
    const res = await fetch(`/api/payments?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      setRows(data.payments);
      setTotal(data.total);
    }
    setLoading(false);
  }, [page, debouncedQuery, method, status]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, method, status]);

  const totalPaid = rows.filter((p) => p.status === "Success").reduce((s, p) => s + p.amount, 0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Payment History</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {total} transaction{total === 1 ? "" : "s"} · {formatCurrency(totalPaid, currency)} on this page
          </p>
        </div>
        <a href="/api/export/payments">
          <Button variant="outline">
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        </a>
      </div>

      <Card className="p-4">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input placeholder="Search by domain or transaction ID..." className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <Select value={method} onChange={(e) => setMethod(e.target.value)} className="lg:w-52">
            <option value="All">All payment methods</option>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="lg:w-44">
            <option value="All">All statuses</option>
            <option value="Success">Success</option>
            <option value="Failed">Failed</option>
            <option value="Pending">Pending</option>
          </Select>
        </div>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center h-64 text-slate-400 text-sm">Loading payments...</div>
      ) : rows.length === 0 ? (
        <Card className="p-12 text-center">
          <Receipt className="h-8 w-8 text-slate-300 mx-auto" />
          <p className="mt-3 text-sm text-slate-400">
            {total === 0 && !debouncedQuery && method === "All" && status === "All"
              ? "No payments recorded yet. Renew a domain to see it here."
              : "No transactions match your filters."}
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-left text-xs text-slate-400 uppercase tracking-wide">
                  <th className="px-5 py-3 font-medium">Transaction ID</th>
                  <th className="px-5 py-3 font-medium">Domain</th>
                  <th className="px-5 py-3 font-medium">Amount</th>
                  <th className="px-5 py-3 font-medium">Method</th>
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="border-b last:border-0 border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-smooth">
                    <td className="px-5 py-3.5">
                      <Link href={`/payments/${p.id}`} className="font-mono text-xs text-brand hover:underline">
                        {p.transactionId}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 text-foreground font-medium">{p.domainNameSnapshot}</td>
                    <td className="px-5 py-3.5 text-foreground">{formatCurrency(p.amount, currency)}</td>
                    <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400">{p.method}</td>
                    <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400">{formatDate(p.date.slice(0, 10))}</td>
                    <td className="px-5 py-3.5">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                          p.status === "Success" && "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
                          p.status === "Failed" && "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400",
                          p.status === "Pending" && "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
                        )}
                      >
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 dark:border-slate-800 text-sm">
              <span className="text-slate-400">
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
