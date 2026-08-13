"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { SUPPORTED_CURRENCIES } from "@/lib/currency";
import { toast } from "sonner";
import { Sun, Moon, Laptop, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/confirm-dialog";

interface Prefs {
  notify30: boolean;
  notify15: boolean;
  notify7: boolean;
  notify3: boolean;
  notify1: boolean;
  notifyExpired: boolean;
}

const INTERVAL_LABELS: { key: keyof Prefs; label: string; description: string }[] = [
  { key: "notify30", label: "30 days before expiry", description: "Upcoming reminder" },
  { key: "notify15", label: "15 days before expiry", description: "Reminder" },
  { key: "notify7", label: "7 days before expiry", description: "Warning" },
  { key: "notify3", label: "3 days before expiry", description: "Urgent" },
  { key: "notify1", label: "1 day before expiry", description: "Critical" },
  { key: "notifyExpired", label: "On expiry date", description: "Expired alert" },
];

export default function SettingsPage() {
  const { data: session, update } = useSession();
  const { theme, setTheme } = useTheme();
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [currency, setCurrency] = useState(session?.user?.currency ?? "INR");
  const [saving, setSaving] = useState(false);
  const [logoutConfirm, setLogoutConfirm] = useState(false);

  useEffect(() => {
    fetch("/api/notifications/preferences")
      .then((r) => r.json())
      .then((d) => setPrefs(d.preferences));
  }, []);

  useEffect(() => {
    if (session?.user?.currency) setCurrency(session.user.currency);
  }, [session?.user?.currency]);

  async function savePrefs() {
    if (!prefs) return;
    setSaving(true);
    const res = await fetch("/api/notifications/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(prefs),
    });
    setSaving(false);
    if (!res.ok) {
      toast.error("Could not save preferences.");
      return;
    }
    toast.success("Reminder preferences saved.");
  }

  async function saveCurrency() {
    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: session?.user?.name, currency }),
    });
    if (!res.ok) {
      toast.error("Could not update currency.");
      return;
    }
    toast.success("Currency updated.");
    await update();
  }

  return (
    <div className="max-w-2xl space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Settings</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Configure Domiify to match your workflow.</p>
      </div>

      <Card className="p-6">
        <h3 className="text-sm font-semibold text-foreground mb-1">Appearance</h3>
        <p className="text-xs text-slate-400 mb-4">Choose how Domiify looks on your device.</p>
        <div className="grid grid-cols-3 gap-3">
          {[
            { value: "light", label: "Light", icon: Sun },
            { value: "dark", label: "Dark", icon: Moon },
            { value: "system", label: "System", icon: Laptop },
          ].map((opt) => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.value}
                onClick={() => setTheme(opt.value)}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-sm font-medium transition-smooth",
                  theme === opt.value
                    ? "border-brand bg-brand/5 text-brand"
                    : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300",
                )}
              >
                <Icon className="h-5 w-5" />
                {opt.label}
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-sm font-semibold text-foreground mb-1">Currency</h3>
        <p className="text-xs text-slate-400 mb-4">Used across the dashboard, domains, and payment records.</p>
        <div className="flex gap-3">
          <Select value={currency} onChange={(e) => setCurrency(e.target.value)} className="max-w-xs">
            {SUPPORTED_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <Button onClick={saveCurrency}>Save</Button>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-sm font-semibold text-foreground mb-1">Reminder Preferences</h3>
        <p className="text-xs text-slate-400 mb-4">Enable or disable specific reminder intervals before a domain expires.</p>
        {!prefs ? (
          <p className="text-sm text-slate-400">Loading...</p>
        ) : (
          <div className="space-y-1">
            {INTERVAL_LABELS.map((item) => (
              <label
                key={item.key}
                className="flex items-center justify-between gap-4 py-2.5 border-b last:border-0 border-slate-50 dark:border-slate-800/50 cursor-pointer"
              >
                <span>
                  <span className="block text-sm font-medium text-foreground">{item.label}</span>
                  <span className="block text-xs text-slate-400">{item.description}</span>
                </span>
                <input
                  type="checkbox"
                  checked={prefs[item.key]}
                  onChange={(e) => setPrefs({ ...prefs, [item.key]: e.target.checked })}
                  className="h-5 w-5 rounded accent-indigo-600 cursor-pointer"
                />
              </label>
            ))}
          </div>
        )}
        <Button className="mt-4" onClick={savePrefs} loading={saving}>
          Save preferences
        </Button>
      </Card>

      <Card className="p-6">
        <h3 className="text-sm font-semibold text-foreground mb-1">Account</h3>
        <p className="text-xs text-slate-400 mb-4">Session and account actions.</p>
        <Button variant="danger" onClick={() => setLogoutConfirm(true)}>
          <LogOut className="h-4 w-4" /> Log out of Domiify
        </Button>
      </Card>

      <ConfirmDialog
        open={logoutConfirm}
        onClose={() => setLogoutConfirm(false)}
        onConfirm={() => signOut({ callbackUrl: "/login" })}
        title="Log out"
        description="Are you sure you want to log out of Domiify?"
        confirmLabel="Log out"
      />
    </div>
  );
}
