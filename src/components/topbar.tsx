"use client";

import { Menu, LogOut, User as UserIcon } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { NotificationBell } from "./notification-bell";
import { GlobalSearch } from "./global-search";
import { signOut, useSession } from "next-auth/react";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";

export function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const initials = session?.user?.name
    ?.split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="sticky top-0 z-30 h-16 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-[rgb(8,11,18)]/80 backdrop-blur-md flex items-center gap-4 px-4 lg:px-6">
      <button onClick={onMenuClick} className="lg:hidden text-slate-500 hover:text-foreground">
        <Menu className="h-5 w-5" />
      </button>

      <div className="flex-1 flex items-center gap-3">
        <GlobalSearch />
        <button
          onClick={() => window.dispatchEvent(new CustomEvent("open-command-palette"))}
          className="hidden sm:flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-400 hover:text-foreground hover:bg-slate-50 dark:hover:bg-slate-800 transition-smooth shrink-0"
        >
          <kbd className="text-[10px]">⌘K</kbd> Quick actions
        </button>
      </div>

      <div className="flex items-center gap-1.5">
        <ThemeToggle />
        <NotificationBell />

        <div className="relative ml-1" ref={ref}>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-brand-foreground text-xs font-semibold hover:opacity-90 transition-smooth"
          >
            {initials || <UserIcon className="h-4 w-4" />}
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-2 w-52 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[rgb(15,19,30)] shadow-popover animate-slide-up overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                <p className="text-sm font-medium text-foreground truncate">{session?.user?.name}</p>
                <p className="text-xs text-slate-400 truncate">{session?.user?.email}</p>
              </div>
              <Link
                href="/profile"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-smooth"
              >
                <UserIcon className="h-4 w-4" /> Profile
              </Link>
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-smooth"
              >
                <LogOut className="h-4 w-4" /> Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
