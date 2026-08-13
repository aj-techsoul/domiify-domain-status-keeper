import { DomainStatus, STATUS_COLOR, HealthLevel, HEALTH_META } from "@/lib/domain-utils";
import { cn } from "@/lib/utils";

export function StatusBadge({ status, className }: { status: DomainStatus; className?: string }) {
  const c = STATUS_COLOR[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium", c.bg, c.text, c.badge, className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", c.dot)} />
      {status}
    </span>
  );
}

export function HealthBadge({ level, className }: { level: HealthLevel; className?: string }) {
  const meta = HEALTH_META[level];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300", className)}>
      <span>{meta.emoji}</span>
      {meta.label}
    </span>
  );
}
