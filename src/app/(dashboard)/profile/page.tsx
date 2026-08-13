"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { SUPPORTED_CURRENCIES } from "@/lib/currency";
import { useData } from "@/components/data-provider";
import { toast } from "sonner";
import { User } from "lucide-react";

export default function ProfilePage() {
  const { data: session, update } = useSession();
  const { domains, payments } = useData();
  const [name, setName] = useState(session?.user?.name ?? "");
  const [currency, setCurrency] = useState(session?.user?.currency ?? "INR");
  const [loading, setLoading] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) {
      toast.error("Name must be at least 2 characters.");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, currency }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      toast.error(data.error || "Could not update profile.");
      return;
    }
    toast.success("Profile updated. Refresh to see currency changes everywhere.");
    await update();
  }

  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="max-w-2xl space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Profile</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Manage your account information.</p>
      </div>

      <Card className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand text-brand-foreground text-xl font-semibold">
            {initials || <User className="h-6 w-6" />}
          </div>
          <div>
            <p className="font-semibold text-foreground">{session?.user?.name}</p>
            <p className="text-sm text-slate-400">{session?.user?.email}</p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <Label htmlFor="name">Full name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={session?.user?.email ?? ""} disabled />
            <p className="text-xs text-slate-400 mt-1">Email cannot be changed in the demo version.</p>
          </div>
          <div>
            <Label htmlFor="currency">Preferred currency</Label>
            <Select id="currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" loading={loading}>
            Save changes
          </Button>
        </form>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card className="p-5">
          <p className="text-sm text-slate-500 dark:text-slate-400">Domains tracked</p>
          <p className="text-2xl font-semibold text-foreground mt-1">{domains.length}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-slate-500 dark:text-slate-400">Renewals completed</p>
          <p className="text-2xl font-semibold text-foreground mt-1">{payments.filter((p) => p.status === "Success").length}</p>
        </Card>
      </div>
    </div>
  );
}
