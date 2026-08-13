"use client";

import { useMemo, useState } from "react";
import { useData } from "@/components/data-provider";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { formatDistanceToNow } from "date-fns";
import { Bell, CheckCheck, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { toast } from "sonner";

const TYPE_META: Record<string, { dot: string; label: string }> = {
  Upcoming: { dot: "bg-emerald-500", label: "Upcoming" },
  Reminder: { dot: "bg-amber-500", label: "Reminder" },
  Warning: { dot: "bg-amber-500", label: "Warning" },
  Urgent: { dot: "bg-orange-500", label: "Urgent" },
  Critical: { dot: "bg-red-500", label: "Critical" },
  Expired: { dot: "bg-gray-500", label: "Expired" },
  Renewed: { dot: "bg-emerald-500", label: "Renewed" },
};

export default function NotificationsPage() {
  const { notifications, loading, refreshNotifications } = useData();
  const [filter, setFilter] = useState("All");
  const [readFilter, setReadFilter] = useState("All");

  const filtered = useMemo(() => {
    return notifications
      .filter((n) => filter === "All" || n.type === filter)
      .filter((n) => readFilter === "All" || (readFilter === "Unread" ? !n.read : n.read));
  }, [notifications, filter, readFilter]);

  async function markRead(id: string, read: boolean) {
    await fetch(`/api/notifications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read }),
    });
    refreshNotifications();
  }

  async function markAllRead() {
    const unread = notifications.filter((n) => !n.read);
    await Promise.all(unread.map((n) => fetch(`/api/notifications/${n.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read: true }),
    })));
    toast.success("All notifications marked as read.");
    refreshNotifications();
  }

  async function deleteNotification(id: string) {
    await fetch(`/api/notifications/${id}`, { method: "DELETE" });
    refreshNotifications();
  }

  async function clearRead() {
    const read = notifications.filter((n) => n.read);
    if (read.length === 0) return;
    await Promise.all(read.map((n) => fetch(`/api/notifications/${n.id}`, { method: "DELETE" })));
    toast.success(`${read.length} notification${read.length === 1 ? "" : "s"} cleared.`);
    refreshNotifications();
  }

  const unreadCount = notifications.filter((n) => !n.read).length;
  const readCount = notifications.filter((n) => n.read).length;

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Notification Center</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}` : "You're all caught up"}
          </p>
        </div>
        <div className="flex gap-2">
          {readCount > 0 && (
            <Button variant="outline" onClick={clearRead}>
              <Trash2 className="h-4 w-4" /> Clear read
            </Button>
          )}
          {unreadCount > 0 && (
            <Button variant="outline" onClick={markAllRead}>
              <CheckCheck className="h-4 w-4" /> Mark all as read
            </Button>
          )}
        </div>
      </div>

      <Card className="p-4 flex flex-col sm:flex-row gap-3">
        <Select value={filter} onChange={(e) => setFilter(e.target.value)} className="sm:w-56">
          <option value="All">All types</option>
          {Object.keys(TYPE_META).map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
        <Select value={readFilter} onChange={(e) => setReadFilter(e.target.value)} className="sm:w-44">
          <option value="All">All</option>
          <option value="Unread">Unread</option>
          <option value="Read">Read</option>
        </Select>
        <div className="ml-auto self-center">
          <Link href="/settings" className="text-sm text-brand hover:underline">
            Configure reminder preferences →
          </Link>
        </div>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center h-64 text-slate-400 text-sm">Loading notifications...</div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Bell className="h-8 w-8 text-slate-300 mx-auto" />
          <p className="mt-3 text-sm text-slate-400">No notifications to show.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((n) => {
            const meta = TYPE_META[n.type] ?? { dot: "bg-slate-400", label: n.type };
            return (
              <Card
                key={n.id}
                className={cn("p-4 flex items-start gap-3 transition-smooth", !n.read && "border-brand/30 bg-brand/[0.03]")}
              >
                <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", meta.dot)} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{meta.label}</span>
                    <span className="text-xs text-slate-300 dark:text-slate-600">·</span>
                    <span className="text-xs text-slate-400">{formatDistanceToNow(new Date(n.date), { addSuffix: true })}</span>
                  </div>
                  <p className="text-sm text-foreground mt-1">{n.message}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    onClick={() => markRead(n.id, !n.read)}
                    className="text-xs font-medium text-brand hover:underline"
                  >
                    {n.read ? "Mark unread" : "Mark read"}
                  </button>
                  <button
                    onClick={() => deleteNotification(n.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10"
                    title="Delete notification"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
