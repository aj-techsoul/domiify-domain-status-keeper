"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  Search,
  LayoutDashboard,
  Globe,
  Users,
  Bell,
  Calendar,
  CreditCard,
  BarChart3,
  Settings,
  Plus,
  UserPlus,
  CornerDownLeft,
} from "lucide-react";
import { useDebouncedValue } from "@/lib/hooks";
import { daysRemainingLabel, daysRemaining } from "@/lib/domain-utils";
import { DomainFormModal } from "./domain-form-modal";
import { CustomerFormModal } from "./customer-form-modal";
import type { Domain, Customer } from "@/lib/schema";

type SearchDomain = Domain;
type SearchCustomer = Customer & { domains?: string[] };

interface PaletteItem {
  id: string;
  label: string;
  sublabel?: string;
  icon: React.ComponentType<{ className?: string }>;
  onSelect: () => void;
  group: "Actions" | "Navigate" | "Domains" | "Customers";
}

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/domains", label: "Domains", icon: Globe },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/payments", label: "Payments", icon: CreditCard },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

/**
 * Global Ctrl/Cmd+K command palette (Feature 14) - jump to any page, jump
 * straight to a domain or customer via the same smart-search endpoint the
 * topbar search uses, or fire a real quick action (Add Domain / Add
 * Customer opens the actual form, not just a link to a page that has one).
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 200);
  const [domainResults, setDomainResults] = useState<SearchDomain[]>([]);
  const [customerResults, setCustomerResults] = useState<SearchCustomer[]>([]);
  const [highlighted, setHighlighted] = useState(0);
  const [addDomainOpen, setAddDomainOpen] = useState(false);
  const [addCustomerOpen, setAddCustomerOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setHighlighted(0);
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape" && open) {
        close();
      }
    }
    // Lets other components (e.g. the topbar's "⌘K" hint button) open the
    // palette without lifting its open-state up through props.
    function onOpenRequest() {
      setOpen(true);
    }
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("open-command-palette", onOpenRequest);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("open-command-palette", onOpenRequest);
    };
  }, [open, close]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      setTimeout(() => inputRef.current?.focus(), 10);
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open || !debouncedQuery.trim()) {
      setDomainResults([]);
      setCustomerResults([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setDomainResults(data.domains ?? []);
        setCustomerResults(data.customers ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, open]);

  const items = useMemo<PaletteItem[]>(() => {
    const q = query.trim().toLowerCase();
    const list: PaletteItem[] = [];

    if (!q || "add domain".includes(q) || "new domain".includes(q)) {
      list.push({
        id: "action-add-domain",
        label: "Add Domain",
        sublabel: "Create a new domain",
        icon: Plus,
        group: "Actions",
        onSelect: () => {
          close();
          setAddDomainOpen(true);
        },
      });
    }
    if (!q || "add customer".includes(q) || "new customer".includes(q)) {
      list.push({
        id: "action-add-customer",
        label: "Add Customer",
        sublabel: "Create a new customer",
        icon: UserPlus,
        group: "Actions",
        onSelect: () => {
          close();
          setAddCustomerOpen(true);
        },
      });
    }

    for (const nav of NAV_ITEMS) {
      if (!q || nav.label.toLowerCase().includes(q)) {
        list.push({
          id: `nav-${nav.href}`,
          label: nav.label,
          icon: nav.icon,
          group: "Navigate",
          onSelect: () => {
            close();
            router.push(nav.href);
          },
        });
      }
    }

    if (q) {
      for (const d of domainResults) {
        list.push({
          id: `domain-${d.id}`,
          label: d.name,
          sublabel: daysRemainingLabel(daysRemaining(d.expiryDate)),
          icon: Globe,
          group: "Domains",
          onSelect: () => {
            close();
            router.push(`/domains/${d.id}`);
          },
        });
      }
      for (const c of customerResults) {
        list.push({
          id: `customer-${c.id}`,
          label: c.fullName,
          sublabel: c.email || c.company || (c.username ? `@${c.username}` : undefined),
          icon: Users,
          group: "Customers",
          onSelect: () => {
            close();
            router.push(`/customers/${c.id}`);
          },
        });
      }
    }

    return list;
  }, [query, domainResults, customerResults, close, router]);

  useEffect(() => {
    setHighlighted(0);
  }, [items.length, query]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      items[highlighted]?.onSelect();
    }
  }

  let renderedIndex = -1;
  const groups: PaletteItem["group"][] = ["Actions", "Navigate", "Domains", "Customers"];

  return (
    <>
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[60] flex items-start justify-center pt-24 px-4">
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm animate-fade-in" onClick={close} />
            <div className="relative w-full max-w-xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[rgb(15,19,30)] shadow-popover animate-slide-up overflow-hidden">
              <div className="flex items-center gap-3 px-4 border-b border-slate-100 dark:border-slate-800">
                <Search className="h-4 w-4 text-slate-400 shrink-0" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="Search domains, customers, or jump to a page..."
                  className="h-14 flex-1 bg-transparent text-sm text-foreground placeholder:text-slate-400 focus:outline-none"
                />
                <kbd className="hidden sm:inline-block shrink-0 rounded border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-400">
                  Esc
                </kbd>
              </div>

              <div className="max-h-96 overflow-y-auto py-2">
                {items.length === 0 ? (
                  <p className="text-sm text-slate-400 px-4 py-8 text-center">No matches for &ldquo;{query}&rdquo;</p>
                ) : (
                  groups.map((group) => {
                    const groupItems = items.filter((i) => i.group === group);
                    if (groupItems.length === 0) return null;
                    return (
                      <div key={group} className="mb-1 last:mb-0">
                        <p className="px-4 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{group}</p>
                        {groupItems.map((item) => {
                          renderedIndex++;
                          const isHighlighted = renderedIndex === highlighted;
                          const Icon = item.icon;
                          return (
                            <button
                              key={item.id}
                              onMouseEnter={() => setHighlighted(renderedIndex)}
                              onClick={item.onSelect}
                              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-smooth ${
                                isHighlighted ? "bg-brand/10" : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                              }`}
                            >
                              <Icon className={`h-4 w-4 shrink-0 ${isHighlighted ? "text-brand" : "text-slate-400"}`} />
                              <span className="min-w-0 flex-1">
                                <span className="block text-sm text-foreground truncate">{item.label}</span>
                                {item.sublabel && <span className="block text-xs text-slate-400 truncate">{item.sublabel}</span>}
                              </span>
                              {isHighlighted && <CornerDownLeft className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600 shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}

      <DomainFormModal open={addDomainOpen} onClose={() => setAddDomainOpen(false)} />
      <CustomerFormModal open={addCustomerOpen} onClose={() => setAddCustomerOpen(false)} />
    </>
  );
}
