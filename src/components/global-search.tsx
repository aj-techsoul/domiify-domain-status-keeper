"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { daysRemaining, daysRemainingLabel, getDomainStatus, STATUS_COLOR, formatDate } from "@/lib/domain-utils";
import { formatCurrency } from "@/lib/currency";
import { useSession } from "next-auth/react";
import type { Domain } from "@/lib/schema";

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Domain[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { data: session } = useSession();
  const currency = session?.user?.currency ?? "INR";

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
    if (res.ok) {
      const data = await res.json();
      setResults(data.results);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => search(query), 200);
    return () => clearTimeout(t);
  }, [query, search]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="relative w-full max-w-sm" ref={ref}>
      <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search domains..."
        className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-surface-muted dark:bg-slate-900 pl-9 pr-8 text-sm text-foreground placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition-smooth"
      />
      {query && (
        <button
          onClick={() => {
            setQuery("");
            setResults([]);
          }}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      {open && query && (
        <div className="absolute left-0 right-0 mt-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[rgb(15,19,30)] shadow-popover animate-slide-up z-50 overflow-hidden max-h-96 overflow-y-auto">
          {results.length === 0 ? (
            <p className="text-sm text-slate-400 px-4 py-6 text-center">No domains match &ldquo;{query}&rdquo;</p>
          ) : (
            results.map((d) => {
              const days = daysRemaining(d.expiryDate);
              const status = getDomainStatus(days);
              const colors = STATUS_COLOR[status];
              return (
                <button
                  key={d.id}
                  onClick={() => {
                    router.push(`/domains/${d.id}`);
                    setOpen(false);
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-smooth flex items-center justify-between gap-3 border-b border-slate-50 dark:border-slate-800/50 last:border-0"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-foreground truncate">{d.name}</span>
                    <span className="block text-xs text-slate-400">
                      Expires {formatDate(d.expiryDate)} · {formatCurrency(d.renewalPrice, currency)}
                    </span>
                  </span>
                  <span className={`shrink-0 text-xs font-medium px-2 py-1 rounded-full border ${colors.bg} ${colors.text} ${colors.badge}`}>
                    {daysRemainingLabel(days)}
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
