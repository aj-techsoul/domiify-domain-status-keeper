"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import { CustomerFormModal } from "@/components/customer-form-modal";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { daysRemaining, getDomainStatus, formatDate, getSimpleStatus } from "@/lib/domain-utils";
import { formatCurrency } from "@/lib/currency";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Globe,
  Mail,
  Phone,
  Building2,
  Link as LinkIcon,
  StickyNote,
  Receipt,
  Download,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import type { Customer, Domain, Payment } from "@/lib/schema";

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const currency = session?.user?.currency ?? "INR";

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/customers/${params.id}`);
    if (!res.ok) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    const data = await res.json();
    setCustomer(data.customer);
    setDomains(data.domains);
    setPayments(data.payments);
    setLoading(false);
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <div className="flex items-center justify-center h-96 text-slate-400 text-sm">Loading...</div>;
  }

  if (notFound || !customer) {
    return (
      <Card className="p-12 text-center">
        <p className="text-slate-500 dark:text-slate-400">Customer not found, or they don&apos;t belong to your account.</p>
        <Link href="/customers" className="mt-4 inline-block text-brand font-medium hover:underline">
          Back to Customers
        </Link>
      </Card>
    );
  }

  const totalSpent = payments.filter((p) => p.status === "Success").reduce((s, p) => s + p.amount, 0);
  const statusCounts = domains.reduce(
    (acc, d) => {
      const s = getSimpleStatus(daysRemaining(d.expiryDate));
      acc[s] = (acc[s] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  async function handleDelete() {
    setDeleting(true);
    const res = await fetch(`/api/customers/${customer!.id}`, { method: "DELETE" });
    setDeleting(false);
    if (!res.ok) {
      toast.error("Could not delete customer.");
      return;
    }
    toast.success("Customer deleted.");
    router.push("/customers");
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <Link href="/customers" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand">
        <ArrowLeft className="h-4 w-4" /> Back to Customers
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{customer.fullName}</h1>
          {customer.username && <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">@{customer.username}</p>}
        </div>
        <div className="flex gap-2">
          <a href={`/api/export/domains?ids=${domains.map((d) => d.id).join(",")}`}>
            <Button variant="outline">
              <Download className="h-4 w-4" /> Export Domains
            </Button>
          </a>
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4" /> Edit
          </Button>
          <Button variant="danger" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-xs text-slate-400 uppercase tracking-wide">Domains</p>
          <p className="mt-1 text-xl font-semibold text-foreground">{domains.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-400 uppercase tracking-wide">Urgent / Expired</p>
          <p className="mt-1 text-xl font-semibold text-foreground">{(statusCounts["Urgent"] ?? 0) + (statusCounts["Expired"] ?? 0)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-400 uppercase tracking-wide">Payments</p>
          <p className="mt-1 text-xl font-semibold text-foreground">{payments.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-400 uppercase tracking-wide">Total spent</p>
          <p className="mt-1 text-xl font-semibold text-foreground">{formatCurrency(totalSpent, currency)}</p>
        </Card>
      </div>

      <Card className="p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Contact Details</h3>
        <div className="grid sm:grid-cols-2 gap-3.5 text-sm">
          <DetailRow icon={Mail} label="Email" value={customer.email || "—"} />
          <DetailRow icon={Phone} label="Phone" value={customer.phone || "—"} />
          <DetailRow icon={Building2} label="Company" value={customer.company || "—"} />
          <DetailRow icon={LinkIcon} label="Website" value={customer.website || "—"} />
        </div>
        {customer.notes && (
          <div className="flex items-start gap-2.5 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-sm">
            <StickyNote className="h-4 w-4 text-slate-400 mt-0.5" />
            <p className="text-slate-500 dark:text-slate-400 whitespace-pre-wrap">{customer.notes}</p>
          </div>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
          <Globe className="h-4 w-4 text-slate-400" />
          <h3 className="text-sm font-semibold text-foreground">Domains ({domains.length})</h3>
        </div>
        {domains.length === 0 ? (
          <p className="p-6 text-sm text-slate-400 text-center">No domains assigned to this customer yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-left text-xs text-slate-400 uppercase tracking-wide">
                  <th className="px-5 py-3 font-medium">Domain</th>
                  <th className="px-5 py-3 font-medium">Expires</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium text-right">Renewal</th>
                </tr>
              </thead>
              <tbody>
                {domains.map((d) => {
                  const days = daysRemaining(d.expiryDate);
                  return (
                    <tr key={d.id} className="border-b last:border-0 border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-smooth">
                      <td className="px-5 py-3.5">
                        <Link href={`/domains/${d.id}`} className="font-medium text-foreground hover:text-brand">
                          {d.name}
                        </Link>
                      </td>
                      <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400">{formatDate(d.expiryDate)}</td>
                      <td className="px-5 py-3.5">
                        <StatusBadge status={getDomainStatus(days)} />
                      </td>
                      <td className="px-5 py-3.5 text-right font-medium text-foreground">{formatCurrency(d.renewalPrice, currency)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
          <Receipt className="h-4 w-4 text-slate-400" />
          <h3 className="text-sm font-semibold text-foreground">Payment History ({payments.length})</h3>
        </div>
        {payments.length === 0 ? (
          <p className="p-6 text-sm text-slate-400 text-center">No payments recorded for this customer yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-left text-xs text-slate-400 uppercase tracking-wide">
                  <th className="px-5 py-3 font-medium">Transaction</th>
                  <th className="px-5 py-3 font-medium">Domain</th>
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b last:border-0 border-slate-50 dark:border-slate-800/50">
                    <td className="px-5 py-3.5 font-mono text-xs text-slate-500 dark:text-slate-400">{p.transactionId}</td>
                    <td className="px-5 py-3.5 text-foreground">{p.domainNameSnapshot}</td>
                    <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400">{formatDate(p.date)}</td>
                    <td className="px-5 py-3.5">
                      <Badge
                        className={
                          p.status === "Success"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30"
                            : p.status === "Failed"
                              ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/30"
                              : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30"
                        }
                      >
                        {p.status}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5 text-right font-medium text-foreground">{formatCurrency(p.amount, p.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <CustomerFormModal open={editOpen} onClose={() => setEditOpen(false)} customer={customer} onSaved={load} />
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete customer"
        description={`Are you sure you want to delete "${customer.fullName}"? Their domains will stay in your portfolio but become unassigned.`}
        loading={deleting}
      />
    </div>
  );
}

function DetailRow({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <Icon className="h-4 w-4 text-slate-400 shrink-0" />
      <span className="text-slate-400">{label}:</span>
      <span className="text-foreground font-medium truncate">{value}</span>
    </div>
  );
}
