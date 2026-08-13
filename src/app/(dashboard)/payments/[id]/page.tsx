"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useData } from "@/components/data-provider";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/currency";
import { formatDate } from "@/lib/domain-utils";
import { ArrowLeft, CheckCircle2, XCircle, Clock } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function PaymentDetailPage() {
  const params = useParams<{ id: string }>();
  const { data: session } = useSession();
  const { payments, domains, loading } = useData();
  const currency = session?.user?.currency ?? "INR";

  const payment = useMemo(() => payments.find((p) => p.id === params.id), [payments, params.id]);
  const domain = useMemo(() => domains.find((d) => d.id === payment?.domainId), [domains, payment]);

  if (loading) return <div className="flex items-center justify-center h-96 text-slate-400 text-sm">Loading...</div>;

  if (!payment) {
    return (
      <Card className="p-12 text-center">
        <p className="text-slate-500 dark:text-slate-400">Transaction not found.</p>
        <Link href="/payments" className="mt-4 inline-block text-brand font-medium hover:underline">
          Back to Payments
        </Link>
      </Card>
    );
  }

  const StatusIcon = payment.status === "Success" ? CheckCircle2 : payment.status === "Failed" ? XCircle : Clock;

  return (
    <div className="max-w-2xl space-y-6 animate-fade-in">
      <Link href="/payments" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand">
        <ArrowLeft className="h-4 w-4" /> Back to Payments
      </Link>

      <Card className="p-8 text-center">
        <div
          className={cn(
            "mx-auto h-16 w-16 rounded-full flex items-center justify-center",
            payment.status === "Success" && "bg-emerald-50 dark:bg-emerald-500/10",
            payment.status === "Failed" && "bg-red-50 dark:bg-red-500/10",
            payment.status === "Pending" && "bg-amber-50 dark:bg-amber-500/10",
          )}
        >
          <StatusIcon
            className={cn(
              "h-8 w-8",
              payment.status === "Success" && "text-emerald-600",
              payment.status === "Failed" && "text-red-600",
              payment.status === "Pending" && "text-amber-600",
            )}
          />
        </div>
        <h1 className="mt-4 text-xl font-semibold text-foreground">
          Payment {payment.status === "Success" ? "Successful" : payment.status}
        </h1>
        <p className="mt-1 text-2xl font-semibold text-foreground">{formatCurrency(payment.amount, currency)}</p>

        <div className="mt-6 rounded-xl bg-surface-muted dark:bg-slate-800/50 p-5 space-y-3 text-left">
          <Row label="Domain" value={payment.domainNameSnapshot} />
          <Row label="Transaction ID" value={payment.transactionId} mono />
          <Row label="Payment method" value={payment.method} />
          <Row label="Status" value={payment.status} />
          <Row label="Previous expiry" value={formatDate(payment.previousExpiryDate)} />
          <Row label="New expiry" value={formatDate(payment.newExpiryDate)} />
          <Row label="Date" value={formatDate(payment.date.slice(0, 10))} />
        </div>

        {domain && (
          <Link href={`/domains/${domain.id}`} className="mt-6 inline-block text-sm text-brand font-medium hover:underline">
            View domain details →
          </Link>
        )}
      </Card>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>
      <span className={cn("text-sm text-foreground", mono && "font-mono text-xs")}>{value}</span>
    </div>
  );
}
