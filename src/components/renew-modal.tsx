"use client";

import { useState } from "react";
import { Dialog } from "./ui/dialog";
import { Button } from "./ui/button";
import { formatCurrency } from "@/lib/currency";
import { formatDate, nextExpiryDateOnRenewal, PAYMENT_METHODS, PaymentMethod } from "@/lib/domain-utils";
import { CheckCircle2, CreditCard, Landmark, Smartphone, Wallet, ArrowRight, ArrowLeft, XCircle, type LucideIcon } from "lucide-react";
import type { Domain, Payment } from "@/lib/schema";
import { toast } from "sonner";
import { useData } from "./data-provider";
import { cn } from "@/lib/utils";

const METHOD_ICON: Record<PaymentMethod, LucideIcon> = {
  UPI: Smartphone,
  "Credit Card": CreditCard,
  "Debit Card": CreditCard,
  "Net Banking": Landmark,
  Wallet: Wallet,
};

type Step = "review" | "method" | "confirm" | "processing" | "success" | "failed";

export function RenewModal({ domain, open, onClose, currency }: { domain: Domain | null; open: boolean; onClose: () => void; currency: string }) {
  const { refreshDomains, refreshNotifications, refreshPayments } = useData();
  const [step, setStep] = useState<Step>("review");
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  function reset() {
    setStep("review");
    setMethod(null);
    setPayment(null);
    setErrorMsg("");
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function confirmPayment() {
    if (!domain || !method) return;
    setStep("processing");
    try {
      const res = await fetch(`/api/domains/${domain.id}/renew`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || "Payment failed. Please try again.");
        setStep("failed");
        return;
      }

      setPayment(data.payment);
      setStep("success");
      refreshDomains();
      refreshNotifications();
      refreshPayments();
      toast.success(`${domain.name} renewed successfully!`);
    } catch {
      setErrorMsg("Network error. Please check your connection and try again.");
      setStep("failed");
    }
  }

  if (!domain) return null;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={step === "success" ? "Payment Successful" : step === "failed" ? "Payment Failed" : "Renew Domain"}
      description={step === "review" ? domain.name : undefined}
    >
      {step === "review" && (
        <div className="space-y-5">
          <div className="rounded-xl bg-surface-muted dark:bg-slate-800/50 p-4 space-y-2.5">
            <Row label="Domain" value={domain.name} />
            <Row label="Registrar" value={domain.registrar} />
            <Row label="Current expiry" value={formatDate(domain.expiryDate)} />
            <Row label="New expiry after renewal" value={formatDate(nextExpiryDateOnRenewal(domain.expiryDate))} />
            <Row label="Renewal price" value={formatCurrency(domain.renewalPrice, currency)} strong />
          </div>
          <Button className="w-full" size="lg" onClick={() => setStep("method")}>
            Continue to payment <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {step === "method" && (
        <div className="space-y-5">
          <p className="text-sm text-slate-500 dark:text-slate-400">Select a payment method</p>
          <div className="grid grid-cols-2 gap-3">
            {PAYMENT_METHODS.map((m) => {
              const Icon = METHOD_ICON[m];
              const selected = method === m;
              return (
                <button
                  key={m}
                  onClick={() => setMethod(m)}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-sm font-medium transition-smooth",
                    selected
                      ? "border-brand bg-brand/5 text-brand"
                      : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600",
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {m}
                </button>
              );
            })}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setStep("review")}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <Button className="flex-1" disabled={!method} onClick={() => setStep("confirm")}>
              Continue
            </Button>
          </div>
        </div>
      )}

      {step === "confirm" && method && (
        <div className="space-y-5">
          <div className="rounded-xl bg-surface-muted dark:bg-slate-800/50 p-4 space-y-2.5">
            <Row label="Domain" value={domain.name} />
            <Row label="Payment method" value={method} />
            <Row label="Amount payable" value={formatCurrency(domain.renewalPrice, currency)} strong />
          </div>
          <p className="text-xs text-slate-400">
            This is a simulated payment for demo purposes — no real transaction will be processed.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setStep("method")}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <Button variant="success" className="flex-1" onClick={confirmPayment}>
              Confirm & Pay
            </Button>
          </div>
        </div>
      )}

      {step === "processing" && (
        <div className="py-10 flex flex-col items-center gap-4">
          <div className="h-10 w-10 rounded-full border-4 border-brand/20 border-t-brand animate-spin" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Processing your payment...</p>
        </div>
      )}

      {step === "success" && payment && (
        <div className="text-center space-y-5">
          <div className="mx-auto h-14 w-14 rounded-full bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center">
            <CheckCircle2 className="h-7 w-7 text-emerald-600" />
          </div>
          <div className="rounded-xl bg-surface-muted dark:bg-slate-800/50 p-4 space-y-2.5 text-left">
            <Row label="Domain" value={domain.name} />
            <Row label="Amount" value={formatCurrency(payment.amount, currency)} strong />
            <Row label="Payment method" value={payment.method} />
            <Row label="Transaction ID" value={payment.transactionId} mono />
            <Row label="New expiry date" value={formatDate(payment.newExpiryDate)} />
            <Row label="Date" value={formatDate(payment.date.slice(0, 10))} />
          </div>
          <Button className="w-full" onClick={handleClose}>
            Done
          </Button>
        </div>
      )}

      {step === "failed" && (
        <div className="text-center space-y-5">
          <div className="mx-auto h-14 w-14 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center">
            <XCircle className="h-7 w-7 text-red-600" />
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300">{errorMsg}</p>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={handleClose}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={() => setStep("confirm")}>
              Try again
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}

function Row({ label, value, strong, mono }: { label: string; value: string; strong?: boolean; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>
      <span className={cn("text-sm text-right text-foreground", strong && "font-semibold", mono && "font-mono text-xs")}>
        {value}
      </span>
    </div>
  );
}
