"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { CustomerFormModal } from "@/components/customer-form-modal";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useDebouncedValue } from "@/lib/hooks";
import { Plus, Search, Pencil, Trash2, Eye, Download, Globe, Mail, Building2 } from "lucide-react";
import Link from "next/link";
import type { Customer } from "@/lib/schema";
import { toast } from "sonner";

type CustomerRow = Customer & { domainCount: number };

export default function CustomersPage() {
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 300);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Customer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (debouncedQuery) params.set("q", debouncedQuery);
    const res = await fetch(`/api/customers?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      setRows(data.customers);
      setTotal(data.total);
    }
    setLoading(false);
  }, [page, debouncedQuery]);

  useEffect(() => {
    load();
  }, [load]);

  // Reset to page 1 whenever the (debounced) search term changes, so a new
  // search never lands on an out-of-range page from the previous query.
  useEffect(() => {
    setPage(1);
  }, [debouncedQuery]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await fetch(`/api/customers/${deleteTarget.id}`, { method: "DELETE" });
    setDeleting(false);
    if (!res.ok) {
      const data = await res.json();
      toast.error(data.error || "Could not delete customer.");
      return;
    }
    toast.success(`${deleteTarget.fullName} removed.`);
    setDeleteTarget(null);
    load();
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Customers</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{total} customer{total === 1 ? "" : "s"} on file</p>
        </div>
        <div className="flex gap-2">
          <a href="/api/export/customers">
            <Button variant="outline">
              <Download className="h-4 w-4" /> Export CSV
            </Button>
          </a>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Add Customer
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search by name, username, email, or company..."
            className="pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center h-64 text-slate-400 text-sm">Loading customers...</div>
      ) : rows.length === 0 ? (
        <Card className="p-12 text-center text-sm text-slate-400">
          {debouncedQuery ? "No customers match your search." : "You haven't added any customers yet."}
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-left text-xs text-slate-400 uppercase tracking-wide">
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Contact</th>
                  <th className="px-5 py-3 font-medium">Company</th>
                  <th className="px-5 py-3 font-medium">Domains</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className="border-b last:border-0 border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-smooth">
                    <td className="px-5 py-3.5">
                      <Link href={`/customers/${c.id}`} className="font-medium text-foreground hover:text-brand">
                        {c.fullName}
                      </Link>
                      {c.username && <div className="text-xs text-slate-400">@{c.username}</div>}
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400">
                      {c.email && (
                        <div className="flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5" /> {c.email}
                        </div>
                      )}
                      {!c.email && !c.phone && <span className="text-slate-300 dark:text-slate-600">—</span>}
                      {c.phone && <div className="text-xs text-slate-400">{c.phone}</div>}
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400">
                      {c.company ? (
                        <div className="flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5" /> {c.company}
                        </div>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1.5 text-foreground font-medium">
                        <Globe className="h-3.5 w-3.5 text-slate-400" /> {c.domainCount}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/customers/${c.id}`} className="p-2 text-slate-400 hover:text-brand rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                          <Eye className="h-4 w-4" />
                        </Link>
                        <button onClick={() => setEditTarget(c)} className="p-2 text-slate-400 hover:text-brand rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => setDeleteTarget(c)} className="p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
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

      <CustomerFormModal open={addOpen} onClose={() => setAddOpen(false)} onSaved={load} />
      <CustomerFormModal open={!!editTarget} onClose={() => setEditTarget(null)} customer={editTarget} onSaved={load} />
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete customer"
        description={`Are you sure you want to delete "${deleteTarget?.fullName}"? Their domains will stay in your portfolio but become unassigned.`}
        loading={deleting}
      />
    </div>
  );
}
