"use client";

import { useState, useRef, useEffect } from "react";
import { Bell } from "lucide-react";
import Link from "next/link";
import { useData } from "./data-provider";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

const TYPE_DOT: Record<string, string> = {
  Upcoming: "bg-emerald-500",
  Reminder: "bg-amber-500",
  Warning: "bg-amber-500",
  Urgent: "bg-orange-500",
  Critical: "bg-red-500",
  Expired: "bg-gray-500",
  Renewed: "bg-emerald-500",
};

export function NotificationBell() {
  const { notifications, refreshNotifications } = useData();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const unread = notifications.filter((n) => !n.read);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read: true }),
    });
    refreshNotifications();
  }

  const recent = notifications.slice(0, 6);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-slate-400 transition-smooth"
        aria-label="Notifications"
      >
        <Bell className="h-[18px] w-[18px]" />
        {unread.length > 0 && (
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-[rgb(15,19,30)]" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[rgb(15,19,30)] shadow-popover animate-slide-up z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
            <p className="font-semibold text-sm text-foreground">Notifications</p>
            {unread.length > 0 && <span className="text-xs text-slate-400">{unread.length} unread</span>}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {recent.length === 0 ? (
              <p className="text-sm text-slate-400 px-4 py-8 text-center">You&apos;re all caught up.</p>
            ) : (
              recent.map((n) => (
                <button
                  key={n.id}
                  onClick={() => markRead(n.id)}
                  className={cn(
                    "w-full text-left px-4 py-3 border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-smooth flex gap-2.5",
                    !n.read && "bg-brand/5",
                  )}
                >
                  <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", TYPE_DOT[n.type] ?? "bg-slate-400")} />
                  <span className="min-w-0">
                    <span className="block text-sm text-foreground leading-snug">{n.message}</span>
                    <span className="block text-xs text-slate-400 mt-1">
                      {formatDistanceToNow(new Date(n.date), { addSuffix: true })}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="block text-center text-sm font-medium text-brand py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-smooth"
          >
            View all notifications
          </Link>
        </div>
      )}
    </div>
  );
}
