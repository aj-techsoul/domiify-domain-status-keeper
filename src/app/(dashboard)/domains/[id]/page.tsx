"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useData } from "@/components/data-provider";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { StatusBadge, HealthBadge } from "@/components/status-badge";
import { CustomerPicker } from "@/components/customer-picker";
import {
  daysRemaining,
  getDomainStatus,
  getHealthLevel,
  daysRemainingLabel,
  formatDate,
} from "@/lib/domain-utils";
import { formatCurrency } from "@/lib/currency";
import { ArrowLeft, Pencil, Trash2, Globe, Calendar, Building2, Tag, StickyNote, Receipt, UserCog, User, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { RenewModal } from "@/components/renew-modal";
import { DomainFormModal } from "@/components/domain-form-modal";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { toast } from "sonner";
import type { Customer } from "@/lib/schema";

export default function DomainDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const { domains, payments, loading, refreshDomains } = useData();
  const currency = session?.user?.currency ?? "INR";

  const domain = useMemo(() => domains.find((d) => d.id === params.id), [domains, params.id]);
  const domainPayments = useMemo(
    () => payments.filter((p) => p.domainId === params.id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [payments, params.id],
  );

  const [renewOpen, setRenewOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [owner, setOwner] = useState<Customer | null>(null);
  const [ownerLoaded, setOwnerLoaded] = useState(false);
  const [ownerDraft, setOwnerDraft] = useState<Customer | null>(null);
  const [ownerModalOpen, setOwnerModalOpen] = useState(false);
  const [savingOwner, setSavingOwner] = useState(false);

  const loadOwner = useCallback(() => {
    if (!params.id) return;
    fetch(`/api/domains/${params.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setOwner(data?.customer ?? null))
      .finally(() => setOwnerLoaded(true));
  }, [params.id]);

  useEffect(() => {
    loadOwner();
  }, [loadOwner]);

  async function saveOwner() {
    setSavingOwner(true);
    const res = await fetch(`/api/domains/${params.id}/owner`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerId: ownerDraft?.id ?? null }),
    });
    setSavingOwner(false);
    if (!res.ok) {
      toast.error("Could not update owner.");
      return;
    }
    toast.success("Owner updated.");
    setOwner(ownerDraft);
    setOwnerModalOpen(false);
  }

  if (loading) {
    return <div className="flex items-center justify-center h-96 text-slate-400 text-sm">Loading...</div>;
  }

  if (!domain) {
    return (
      <Card className="p-12 text-center">
        <p className="text-slate-500 dark:text-slate-400">Domain not found, or it doesn&apos;t belong to your account.</p>
        <Link href="/domains" className="mt-4 inline-block text-brand font-medium hover:underline">
          Back to Domains
        </Link>
      </Card>
    );
  }

  const days = daysRemaining(domain.expiryDate);
  const status = getDomainStatus(days);
  const health = getHealthLevel(days);

  async function handleDelete() {
    setDeleting(true);
    const res = await fetch(`/api/domains/${domain!.id}`, { method: "DELETE" });
    setDeleting(false);
    if (!res.ok) {
      toast.error("Could not delete domain.");
      return;
    }
    toast.success("Domain deleted.");
    refreshDomains();
    router.push("/domains");
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <Link href="/domains" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand">
        <ArrowLeft className="h-4 w-4" /> Back to Domains
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{domain.name}</h1>
            <StatusBadge status={status} />
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5">
            <HealthBadge level={health} />
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4" /> Edit
          </Button>
          <Button variant="danger" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
          <Button onClick={() => setRenewOpen(true)}>Renew Now</Button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Domain Details</h3>
          <div className="space-y-3.5 text-sm">
            <DetailRow icon={Building2} label="Registrar" value={domain.registrar} />
            <DetailRow icon={Tag} label="Category" value={domain.category} />
            <DetailRow icon={Calendar} label="Purchase date" value={formatDate(domain.purchaseDate)} />
            <DetailRow icon={Calendar} label="Expiry date" value={formatDate(domain.expiryDate)} />
            <DetailRow icon={Globe} label="Days remaining" value={daysRemainingLabel(days)} />
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Renewal & Notes</h3>
          <div className="space-y-3.5 text-sm">
            <DetailRow icon={Receipt} label="Renewal price" value={formatCurrency(domain.renewalPrice, currency)} />
            <div className="flex items-start gap-2.5">
              <StickyNote className="h-4 w-4 text-slate-400 mt-0.5" />
              <div>
                <p className="text-slate-500 dark:text-slate-400 text-xs mb-1">Notes</p>
                <p className="text-foreground">{domain.notes || "No notes added."}</p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground">Owner</h3>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setOwnerDraft(owner);
              setOwnerModalOpen(true);
            }}
            disabled={!ownerLoaded}
          >
            <UserCog className="h-4 w-4" /> Change Owner
          </Button>
        </div>
        {!ownerLoaded ? (
          <p className="text-sm text-slate-400">Loading...</p>
        ) : owner ? (
          <Link href={`/customers/${owner.id}`} className="flex items-center gap-3 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/10 text-brand shrink-0">
              <User className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground group-hover:text-brand">{owner.fullName}</p>
              <p className="text-xs text-slate-400">{owner.email || owner.company || (owner.username ? `@${owner.username}` : "No contact info")}</p>
            </div>
          </Link>
        ) : (
          <p className="text-sm text-slate-400">This domain isn&apos;t assigned to a customer yet.</p>
        )}
      </Card>

      <Card className="p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Payment History for this domain</h3>
        {domainPayments.length === 0 ? (
          <p className="text-sm text-slate-400">No renewal payments yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400 uppercase border-b border-slate-100 dark:border-slate-800">
                  <th className="py-2 font-medium">Transaction ID</th>
                  <th className="py-2 font-medium">Amount</th>
                  <th className="py-2 font-medium">Method</th>
                  <th className="py-2 font-medium">Status</th>
                  <th className="py-2 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {domainPayments.map((p) => (
                  <tr key={p.id} className="border-b last:border-0 border-slate-50 dark:border-slate-800/50">
                    <td className="py-2.5 font-mono text-xs">{p.transactionId}</td>
                    <td className="py-2.5 font-medium">{formatCurrency(p.amount, currency)}</td>
                    <td className="py-2.5 text-slate-500 dark:text-slate-400">{p.method}</td>
                    <td className="py-2.5">
                      <span
                        className={
                          p.status === "Success"
                            ? "text-emerald-600 dark:text-emerald-400"
                            : p.status === "Failed"
                              ? "text-red-600 dark:text-red-400"
                              : "text-amber-600"
                        }
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="py-2.5 text-slate-500 dark:text-slate-400">{formatDate(p.date.slice(0, 10))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <RenewModal domain={domain} open={renewOpen} onClose={() => setRenewOpen(false)} currency={currency} />
      <DomainFormModal
        open={editOpen}
        onClose={() => {
          setEditOpen(false);
          loadOwner();
        }}
        domain={domain}
      />
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete domain"
        description={`Are you sure you want to delete "${domain.name}"? This cannot be undone.`}
        loading={deleting}
      />
      <Dialog open={ownerModalOpen} onClose={() => setOwnerModalOpen(false)} title="Change Owner" className="max-w-md">
        <div className="space-y-4">
          <CustomerPicker value={ownerDraft} onChange={setOwnerDraft} />
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setOwnerModalOpen(false)}>
              Cancel
            </Button>
            <Button className="flex-1" loading={savingOwner} onClick={saveOwner}>
              Save
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

function DetailRow({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <Icon className="h-4 w-4 text-slate-400 shrink-0" />
      <span className="text-slate-500 dark:text-slate-400 w-32 shrink-0">{label}</span>
      <span className="text-foreground font-medium">{value}</span>
    </div>
  );
}
