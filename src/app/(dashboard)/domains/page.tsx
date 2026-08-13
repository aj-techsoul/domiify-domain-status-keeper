"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useData } from "@/components/data-provider";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { CustomerPicker } from "@/components/customer-picker";
import { Dialog } from "@/components/ui/dialog";
import { daysRemaining, getDomainStatus, daysRemainingLabel, formatDate, DOMAIN_CATEGORIES, DomainStatus, PAYMENT_METHODS, PaymentMethod } from "@/lib/domain-utils";
import { formatCurrency } from "@/lib/currency";
import { useDebouncedValue } from "@/lib/hooks";
import { Plus, Search, Pencil, Trash2, Eye, LayoutGrid, List, Download, RefreshCw, UserCog, X } from "lucide-react";
import Link from "next/link";
import { DomainFormModal } from "@/components/domain-form-modal";
import { RenewModal } from "@/components/renew-modal";
import { ConfirmDialog } from "@/components/confirm-dialog";
import type { Domain, Customer } from "@/lib/schema";
import { toast } from "sonner";

type SortKey = "expiry-asc" | "expiry-desc" | "price-asc" | "price-desc" | "name-asc";
type DomainRow = Domain & { customer: Customer | null };

const STATUS_FILTERS: (DomainStatus | "All")[] = ["All", "Safe", "Upcoming", "Reminder", "Warning", "Urgent", "Critical", "Expired"];

export default function DomainsPage() {
  const { data: session } = useSession();
  const { refreshDomains, refreshNotifications, refreshPayments } = useData();
  const currency = session?.user?.currency ?? "INR";

  // This page talks to the paginated /api/domains route directly instead of
  // reading the full DataProvider list (Feature 15 - performance): with a
  // large portfolio, only the current page's rows and a single COUNT ever
  // cross the wire, and search debounces so typing doesn't fire a query per
  // keystroke.
  const [rows, setRows] = useState<DomainRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 300);
  const [category, setCategory] = useState<string>("All");
  const [status, setStatus] = useState<string>("All");
  const [sort, setSort] = useState<SortKey>("expiry-asc");
  const [view, setView] = useState<"table" | "grid">("table");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Domain | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Domain | null>(null);
  const [renewTarget, setRenewTarget] = useState<Domain | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [bulkAssignTarget, setBulkAssignTarget] = useState<Customer | null>(null);
  const [bulkRenewOpen, setBulkRenewOpen] = useState(false);
  const [bulkMethod, setBulkMethod] = useState<PaymentMethod>(PAYMENT_METHODS[0]);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), sort });
    if (debouncedQuery) params.set("q", debouncedQuery);
    if (category !== "All") params.set("category", category);
    if (status !== "All") params.set("status", status);
    const res = await fetch(`/api/domains?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      setRows(data.domains);
      setTotal(data.total);
    }
    setLoading(false);
  }, [page, debouncedQuery, category, status, sort]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, category, status]);

  useEffect(() => {
    setSelected(new Set());
  }, [rows]);

  function afterMutate() {
    load();
    refreshDomains();
    refreshNotifications();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await fetch(`/api/domains/${deleteTarget.id}`, { method: "DELETE" });
    setDeleting(false);
    if (!res.ok) {
      const data = await res.json();
      toast.error(data.error || "Could not delete domain.");
      return;
    }
    toast.success(`${deleteTarget.name} deleted.`);
    setDeleteTarget(null);
    afterMutate();
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected((prev) => (prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.id))));
  }

  async function runBulk(body: Record<string, unknown>, successMessage: (data: { affected?: number; renewed?: number; failed?: number }) => string) {
    setBulkBusy(true);
    try {
      const res = await fetch("/api/domains/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domainIds: Array.from(selected), ...body }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Bulk action failed.");
        return;
      }
      toast.success(successMessage(data));
      setSelected(new Set());
      afterMutate();
      refreshPayments();
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setBulkBusy(false);
    }
  }

  async function handleBulkDelete() {
    if (!confirm(`Delete ${selected.size} selected domain(s)? This cannot be undone.`)) return;
    await runBulk({ action: "delete" }, (d) => `${d.affected} domain(s) deleted.`);
  }

  async function handleBulkAssign() {
    if (!bulkAssignTarget) return;
    await runBulk({ action: "assignCustomer", customerId: bulkAssignTarget.id }, (d) => `${d.affected} domain(s) assigned to ${bulkAssignTarget.fullName}.`);
    setBulkAssignOpen(false);
    setBulkAssignTarget(null);
  }

  async function handleBulkRenew() {
    await runBulk({ action: "renew", method: bulkMethod }, (d) => `${d.renewed} domain(s) renewed${d.failed ? `, ${d.failed} failed` : ""}.`);
    setBulkRenewOpen(false);
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Domains</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{total} domain{total === 1 ? "" : "s"} in your portfolio</p>
        </div>
        <div className="flex gap-2">
          <a href="/api/export/domains">
            <Button variant="outline">
              <Download className="h-4 w-4" /> Export CSV
            </Button>
          </a>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Add Domain
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input placeholder="Search domains..." className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <Select value={category} onChange={(e) => setCategory(e.target.value)} className="lg:w-48">
            <option value="All">All categories</option>
            {DOMAIN_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="lg:w-48">
            {STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>
                {s === "All" ? "All statuses" : s}
              </option>
            ))}
          </Select>
          <Select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="lg:w-56">
            <option value="expiry-asc">Expiry: soonest first</option>
            <option value="expiry-desc">Expiry: latest first</option>
            <option value="price-desc">Price: high to low</option>
            <option value="price-asc">Price: low to high</option>
            <option value="name-asc">Name: A-Z</option>
          </Select>
          <div className="flex gap-1 rounded-lg border border-slate-200 dark:border-slate-700 p-1">
            <button
              onClick={() => setView("table")}
              className={`h-8 w-8 flex items-center justify-center rounded-md ${view === "table" ? "bg-brand text-brand-foreground" : "text-slate-400"}`}
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => setView("grid")}
              className={`h-8 w-8 flex items-center justify-center rounded-md ${view === "grid" ? "bg-brand text-brand-foreground" : "text-slate-400"}`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
        </div>
      </Card>

      {selected.size > 0 && (
        <Card className="p-3 flex flex-wrap items-center gap-3 bg-brand/5 border-brand/30">
          <span className="text-sm font-medium text-foreground px-2">{selected.size} selected</span>
          <Button size="sm" variant="secondary" onClick={() => setBulkRenewOpen(true)} disabled={bulkBusy}>
            <RefreshCw className="h-3.5 w-3.5" /> Renew
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setBulkAssignOpen(true)} disabled={bulkBusy}>
            <UserCog className="h-3.5 w-3.5" /> Assign Customer
          </Button>
          <Button size="sm" variant="danger" onClick={handleBulkDelete} disabled={bulkBusy}>
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </Button>
          <button onClick={() => setSelected(new Set())} className="ml-auto p-1.5 text-slate-400 hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64 text-slate-400 text-sm">Loading domains...</div>
      ) : rows.length === 0 ? (
        <Card className="p-12 text-center text-sm text-slate-400">
          {total === 0 && !debouncedQuery && category === "All" && status === "All"
            ? "You haven't added any domains yet."
            : "No domains match your filters."}
        </Card>
      ) : view === "table" ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-left text-xs text-slate-400 uppercase tracking-wide">
                  <th className="px-5 py-3 font-medium w-8">
                    <input type="checkbox" checked={selected.size === rows.length} onChange={toggleSelectAll} className="rounded" />
                  </th>
                  <th className="px-5 py-3 font-medium">Domain</th>
                  <th className="px-5 py-3 font-medium">Owner</th>
                  <th className="px-5 py-3 font-medium">Category</th>
                  <th className="px-5 py-3 font-medium">Expires</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Renewal</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => {
                  const days = daysRemaining(d.expiryDate);
                  const st = getDomainStatus(days);
                  return (
                    <tr key={d.id} className="border-b last:border-0 border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-smooth">
                      <td className="px-5 py-3.5">
                        <input type="checkbox" checked={selected.has(d.id)} onChange={() => toggleSelected(d.id)} className="rounded" />
                      </td>
                      <td className="px-5 py-3.5">
                        <Link href={`/domains/${d.id}`} className="font-medium text-foreground hover:text-brand">
                          {d.name}
                        </Link>
                        <div className="text-xs text-slate-400">{d.registrar}</div>
                      </td>
                      <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400">
                        {d.customer ? (
                          <Link href={`/customers/${d.customer.id}`} className="hover:text-brand">
                            {d.customer.fullName}
                          </Link>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600">Unassigned</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400">{d.category}</td>
                      <td className="px-5 py-3.5">
                        <div className="text-foreground">{formatDate(d.expiryDate)}</div>
                        <div className="text-xs text-slate-400">{daysRemainingLabel(days)}</div>
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusBadge status={st} />
                      </td>
                      <td className="px-5 py-3.5 font-medium text-foreground">{formatCurrency(d.renewalPrice, currency)}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="secondary" onClick={() => setRenewTarget(d)}>
                            Renew
                          </Button>
                          <Link href={`/domains/${d.id}`} className="p-2 text-slate-400 hover:text-brand rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                            <Eye className="h-4 w-4" />
                          </Link>
                          <button onClick={() => setEditTarget(d)} className="p-2 text-slate-400 hover:text-brand rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button onClick={() => setDeleteTarget(d)} className="p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
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
      ) : (
        <>
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {rows.map((d) => {
              const days = daysRemaining(d.expiryDate);
              const st = getDomainStatus(days);
              return (
                <Card key={d.id} className="p-5 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex items-start gap-2">
                      <input type="checkbox" checked={selected.has(d.id)} onChange={() => toggleSelected(d.id)} className="rounded mt-1" />
                      <div className="min-w-0">
                        <Link href={`/domains/${d.id}`} className="font-semibold text-foreground truncate hover:text-brand block">
                          {d.name}
                        </Link>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {d.registrar} · {d.category}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={st} />
                  </div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    Expires {formatDate(d.expiryDate)} · {daysRemainingLabel(days)}
                  </div>
                  {d.customer && (
                    <Link href={`/customers/${d.customer.id}`} className="text-xs text-slate-400 hover:text-brand -mt-2">
                      Owner: {d.customer.fullName}
                    </Link>
                  )}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-sm font-semibold text-foreground">{formatCurrency(d.renewalPrice, currency)}</span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setEditTarget(d)} className="p-2 text-slate-400 hover:text-brand rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => setDeleteTarget(d)} className="p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10">
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <Button size="sm" onClick={() => setRenewTarget(d)}>
                        Renew
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 text-sm">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <span className="text-slate-400">
                Page {page} of {totalPages}
              </span>
              <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          )}
        </>
      )}

      <DomainFormModal
        open={addOpen}
        onClose={() => {
          setAddOpen(false);
          afterMutate();
        }}
      />
      <DomainFormModal
        open={!!editTarget}
        onClose={() => {
          setEditTarget(null);
          afterMutate();
        }}
        domain={editTarget}
      />
      <RenewModal
        domain={renewTarget}
        open={!!renewTarget}
        onClose={() => {
          setRenewTarget(null);
          afterMutate();
        }}
        currency={currency}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete domain"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This will also remove its notification history. Payment records are kept for your records.`}
        loading={deleting}
      />

      <Dialog open={bulkAssignOpen} onClose={() => setBulkAssignOpen(false)} title={`Assign ${selected.size} domain(s) to a customer`} className="max-w-md">
        <div className="space-y-4">
          <CustomerPicker value={bulkAssignTarget} onChange={setBulkAssignTarget} />
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setBulkAssignOpen(false)}>
              Cancel
            </Button>
            <Button className="flex-1" disabled={!bulkAssignTarget} loading={bulkBusy} onClick={handleBulkAssign}>
              Assign
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog open={bulkRenewOpen} onClose={() => setBulkRenewOpen(false)} title={`Renew ${selected.size} domain(s)`} description="This simulates a payment for every selected domain.">
        <div className="space-y-4">
          <Select value={bulkMethod} onChange={(e) => setBulkMethod(e.target.value as PaymentMethod)}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setBulkRenewOpen(false)}>
              Cancel
            </Button>
            <Button variant="success" className="flex-1" loading={bulkBusy} onClick={handleBulkRenew}>
              Confirm & Renew
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
