"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { MailCheck } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Demo-mode UI only: no email delivery is wired up. In production this
    // would call an API route that issues a signed reset token and emails it.
    setSent(true);
  }

  if (sent) {
    return (
      <div className="text-center animate-slide-up">
        <div className="mx-auto h-12 w-12 rounded-full bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center">
          <MailCheck className="h-6 w-6 text-emerald-600" />
        </div>
        <h1 className="mt-4 text-xl font-semibold text-foreground">Check your email</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          If an account exists for <span className="font-medium text-foreground">{email}</span>, we&apos;ve sent
          password reset instructions.
        </p>
        <p className="mt-1 text-xs text-slate-400">
          (Demo mode: no email is actually sent — this is a UI-only preview of the flow.)
        </p>
        <Link href="/login" className="mt-6 inline-block text-sm text-brand font-medium hover:underline">
          Back to login
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-slide-up">
      <h1 className="text-2xl font-semibold text-foreground text-center">Reset your password</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 text-center mt-1.5">
        Enter your email and we&apos;ll send reset instructions
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <Button type="submit" className="w-full" size="lg">
          Send reset link
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
        Remembered it?{" "}
        <Link href="/login" className="text-brand font-medium hover:underline">
          Back to login
        </Link>
      </p>
    </div>
  );
}
