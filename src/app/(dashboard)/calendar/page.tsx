"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useData } from "@/components/data-provider";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isToday,
  addMonths,
  subMonths,
  parseISO,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/currency";
import { daysRemaining, getDomainStatus, STATUS_COLOR, formatDate } from "@/lib/domain-utils";
import Link from "next/link";
import type { Domain, Customer } from "@/lib/schema";

export default function CalendarPage() {
  const { data: session } = useSession();
  const { domains, loading } = useData();
  const currency = session?.user?.currency ?? "INR";
  const [cursor, setCursor] = useState(new Date());
  const [selected, setSelected] = useState<Domain | null>(null);
  // The owning customer isn't part of the shared DataProvider list (kept
  // lean for consumers that never need it), so it's fetched on demand only
  // when a calendar entry is actually opened.
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  useEffect(() => {
    if (!selected) {
      setSelectedCustomer(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/domains/${selected.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => !cancelled && setSelectedCustomer(data?.customer ?? null));
    return () => {
      cancelled = true;
    };
  }, [selected]);

  const domainsByDate = useMemo(() => {
    const map = new Map<string, Domain[]>();
    for (const d of domains) {
      const key = d.expiryDate;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(d);
    }
    return map;
  }, [domains]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor));
    const end = endOfWeek(endOfMonth(cursor));
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  const upcomingInMonth = useMemo(() => {
    return domains
      .filter((d) => isSameMonth(parseISO(d.expiryDate), cursor))
      .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
  }, [domains, cursor]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Expiry Calendar</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Visualize when your domains come up for renewal.</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">{format(cursor, "MMMM yyyy")}</h2>
            <div className="flex gap-1">
              <Button variant="outline" size="icon" onClick={() => setCursor((c) => subMonths(c, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCursor(new Date())}>
                Today
              </Button>
              <Button variant="outline" size="icon" onClick={() => setCursor((c) => addMonths(c, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-slate-400 mb-2">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {days.map((day) => {
              const key = format(day, "yyyy-MM-dd");
              const dayDomains = domainsByDate.get(key) ?? [];
              const inMonth = isSameMonth(day, cursor);
              return (
                <div
                  key={key}
                  className={cn(
                    "min-h-[86px] rounded-lg border p-1.5 text-left align-top",
                    inMonth ? "border-slate-100 dark:border-slate-800" : "border-transparent",
                    isToday(day) && "ring-2 ring-brand ring-inset",
                  )}
                >
                  <span className={cn("text-xs", inMonth ? "text-foreground" : "text-slate-300 dark:text-slate-700")}>
                    {format(day, "d")}
                  </span>
                  <div className="mt-1 space-y-1">
                    {dayDomains.slice(0, 2).map((d) => {
                      const status = getDomainStatus(daysRemaining(d.expiryDate));
                      const colors = STATUS_COLOR[status];
                      return (
                        <button
                          key={d.id}
                          onClick={() => setSelected(d)}
                          className={cn("w-full truncate rounded px-1 py-0.5 text-[10px] font-medium text-left", colors.bg, colors.text)}
                          title={d.name}
                        >
                          {d.name}
                        </button>
                      );
                    })}
                    {dayDomains.length > 2 && (
                      <span className="block text-[10px] text-slate-400 px-1">+{dayDomains.length - 2} more</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Expiring this month</h3>
          {loading ? (
            <p className="text-sm text-slate-400">Loading...</p>
          ) : upcomingInMonth.length === 0 ? (
            <p className="text-sm text-slate-400">No domains expire in {format(cursor, "MMMM yyyy")}.</p>
          ) : (
            <div className="space-y-3">
              {upcomingInMonth.map((d) => (
                <button key={d.id} onClick={() => setSelected(d)} className="w-full text-left flex items-center justify-between gap-2 py-1.5 border-b last:border-0 border-slate-50 dark:border-slate-800/50">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{d.name}</p>
                    <p className="text-xs text-slate-400">{format(parseISO(d.expiryDate), "MMMM d")} expires</p>
                  </div>
                  <span className="text-xs font-medium text-foreground shrink-0">{formatCurrency(d.renewalPrice, currency)}</span>
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" />
          <Card className="relative w-full max-w-sm p-5 animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <p className="font-semibold text-foreground">{selected.name}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{selected.registrar} · {selected.category}</p>
            <p className="text-sm text-foreground mt-3">Expires: {formatDate(selected.expiryDate)}</p>
            <p className="text-sm text-foreground">Renewal: {formatCurrency(selected.renewalPrice, currency)}</p>
            <p className="text-sm text-foreground">
              Owner:{" "}
              {selectedCustomer ? (
                <Link href={`/customers/${selectedCustomer.id}`} className="text-brand hover:underline">
                  {selectedCustomer.fullName}
                </Link>
              ) : (
                <span className="text-slate-400">Unassigned</span>
              )}
            </p>
            <div className="flex gap-2 mt-4">
              <Button variant="outline" className="flex-1" onClick={() => setSelected(null)}>
                Close
              </Button>
              <Link href={`/domains/${selected.id}`} className="flex-1">
                <Button className="w-full">View Details</Button>
              </Link>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
