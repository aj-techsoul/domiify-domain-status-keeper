"use client";

import { useEffect, useRef, useState } from "react";
import { Input, Label } from "./ui/input";
import { Button } from "./ui/button";
import { useDebouncedValue } from "@/lib/hooks";
import { Search, UserPlus, X, AlertTriangle, User } from "lucide-react";
import { toast } from "sonner";
import type { Customer } from "@/lib/schema";

type CustomerHit = Pick<Customer, "id" | "fullName" | "username" | "email" | "company">;

/**
 * Searchable customer combobox used by the domain form and the "Change
 * Owner" quick action (Domiify 2.0, Feature 4/9). Typing debounces into a
 * search against the paginated /api/customers endpoint (never the whole
 * table) and either selects an existing customer or, via "Add new
 * customer", creates one on the spot - reusing the same find-or-create
 * dedup + ambiguous-name-collision flow as the standalone Customers page.
 */
export function CustomerPicker({
  value,
  onChange,
  label = "Customer",
}: {
  value: Customer | null;
  onChange: (customer: Customer | null) => void;
  label?: string;
}) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 250);
  const [results, setResults] = useState<CustomerHit[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newForm, setNewForm] = useState({ fullName: "", email: "", username: "" });
  const [ambiguous, setAmbiguous] = useState<CustomerHit | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !debouncedQuery) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    fetch(`/api/customers?q=${encodeURIComponent(debouncedQuery)}&pageSize=6`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setResults(data.customers ?? []);
      })
      .finally(() => !cancelled && setSearching(false));
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, open]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setShowCreate(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function createCustomer(force = false) {
    if (!newForm.fullName.trim()) {
      toast.error("Enter a full name for the new customer.");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newForm, force }),
      });
      const data = await res.json();

      if (res.status === 409 && data.ambiguous) {
        setAmbiguous(data.candidates?.[0] ?? null);
        setCreating(false);
        return;
      }
      if (!res.ok) {
        toast.error(data.error || "Could not create customer.");
        setCreating(false);
        return;
      }

      toast.success(data.created === false ? "Matched an existing customer." : "Customer created.");
      onChange(data.customer);
      resetCreateState();
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setCreating(false);
    }
  }

  function resetCreateState() {
    setShowCreate(false);
    setAmbiguous(null);
    setNewForm({ fullName: "", email: "", username: "" });
    setOpen(false);
    setQuery("");
  }

  if (value) {
    return (
      <div>
        <Label>{label}</Label>
        <div className="flex items-center justify-between rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-2">
          <div className="flex items-center gap-2 min-w-0">
            <User className="h-4 w-4 text-slate-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{value.fullName}</p>
              {(value.email || value.username) && (
                <p className="text-xs text-slate-400 truncate">{value.email || `@${value.username}`}</p>
              )}
            </div>
          </div>
          <button type="button" onClick={() => onChange(null)} className="p-1 text-slate-400 hover:text-red-600 shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <Label>{label}</Label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search customers by name, email, or username..."
          className="pl-9"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
        />
      </div>

      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[rgb(15,19,30)] shadow-popover max-h-72 overflow-y-auto">
          {ambiguous ? (
            <div className="p-3 space-y-3">
              <div className="flex gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  A customer named &ldquo;{ambiguous.fullName}&rdquo; already exists. Same person, or different?
                </p>
              </div>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="secondary" className="flex-1" loading={creating} onClick={() => createCustomer(false)}>
                  Same
                </Button>
                <Button type="button" size="sm" className="flex-1" loading={creating} onClick={() => createCustomer(true)}>
                  Different
                </Button>
              </div>
            </div>
          ) : showCreate ? (
            <div className="p-3 space-y-2">
              <Input
                placeholder="Full name"
                value={newForm.fullName}
                onChange={(e) => setNewForm({ ...newForm, fullName: e.target.value })}
                autoFocus
              />
              <Input
                placeholder="Email (optional)"
                value={newForm.email}
                onChange={(e) => setNewForm({ ...newForm, email: e.target.value })}
              />
              <Input
                placeholder="Username (optional)"
                value={newForm.username}
                onChange={(e) => setNewForm({ ...newForm, username: e.target.value })}
              />
              <div className="flex gap-2 pt-1">
                <Button type="button" size="sm" variant="outline" className="flex-1" onClick={() => setShowCreate(false)}>
                  Back
                </Button>
                <Button type="button" size="sm" className="flex-1" loading={creating} onClick={() => createCustomer(false)}>
                  Create
                </Button>
              </div>
            </div>
          ) : (
            <>
              {searching && <div className="p-3 text-xs text-slate-400">Searching...</div>}
              {!searching && debouncedQuery && results.length === 0 && (
                <div className="p-3 text-xs text-slate-400">No matches for &ldquo;{debouncedQuery}&rdquo;.</div>
              )}
              {results.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    onChange(c as Customer);
                    resetCreateState();
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-smooth"
                >
                  <p className="text-sm font-medium text-foreground">{c.fullName}</p>
                  <p className="text-xs text-slate-400">{c.email || c.company || (c.username ? `@${c.username}` : "")}</p>
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setNewForm({ fullName: query, email: "", username: "" });
                  setShowCreate(true);
                }}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-brand hover:bg-slate-50 dark:hover:bg-slate-800 border-t border-slate-100 dark:border-slate-800 transition-smooth"
              >
                <UserPlus className="h-4 w-4" /> Add new customer
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
