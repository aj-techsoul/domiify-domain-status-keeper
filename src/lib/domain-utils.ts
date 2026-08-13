import { differenceInCalendarDays, parseISO, format, addYears, addDays } from "date-fns";

/**
 * All expiry math lives here. Nothing about "days remaining" or "status" is
 * ever stored in the database - it is always derived from expiryDate vs the
 * current moment, exactly as the spec requires (section 19).
 */

export type DomainStatus =
  | "Safe"
  | "Upcoming"
  | "Reminder"
  | "Warning"
  | "Urgent"
  | "Critical"
  | "Expired";

export type HealthLevel = "Healthy" | "Attention" | "Warning" | "Critical" | "Expired";

export function daysRemaining(expiryDate: string, from: Date = new Date()): number {
  const expiry = parseISO(expiryDate);
  // Compare calendar days only, ignoring time-of-day, so "today" reads as 0.
  return differenceInCalendarDays(expiry, from);
}

/**
 * Maps days-remaining to the reminder-level taxonomy from spec section 4.
 *   30 days  -> Upcoming
 *   15 days  -> Reminder
 *   7 days   -> Warning
 *   3 days   -> Urgent
 *   1 day    -> Critical
 *   <=0      -> Expired
 *   otherwise-> Safe (more than 30 days out)
 */
export function getDomainStatus(daysLeft: number): DomainStatus {
  if (daysLeft <= 0) return "Expired";
  if (daysLeft <= 1) return "Critical";
  if (daysLeft <= 3) return "Urgent";
  if (daysLeft <= 7) return "Warning";
  if (daysLeft <= 15) return "Reminder";
  if (daysLeft <= 30) return "Upcoming";
  return "Safe";
}

/**
 * Coarse 4-bucket status used by the customer profile and dashboard summary
 * cards (Domiify 2.0, Feature 5):
 *   ACTIVE         more than 30 days remaining
 *   EXPIRING SOON  30 days or less remaining
 *   URGENT         7 days or less remaining
 *   EXPIRED        expiry date has passed
 * This is a coarser view of the same `daysRemaining` number the 7-level
 * `getDomainStatus` above uses - never stored, always derived.
 */
export type SimpleStatus = "Active" | "Expiring Soon" | "Urgent" | "Expired";

export function getSimpleStatus(daysLeft: number): SimpleStatus {
  if (daysLeft <= 0) return "Expired";
  if (daysLeft <= 7) return "Urgent";
  if (daysLeft <= 30) return "Expiring Soon";
  return "Active";
}

/**
 * Translates a `DomainStatus` filter value into an expiryDate range so the
 * Domains API can filter status *in SQL* (against the `domains_user_expiry_idx`
 * index) instead of pulling every row into Node to filter in memory - the
 * thing that makes status-filtered pagination actually fast.
 * Returns `{ gt, lte }` as YYYY-MM-DD bounds; either may be omitted for an
 * open-ended range.
 */
export function getStatusDateBounds(status: DomainStatus, from: Date = new Date()): { gt?: string; lte?: string } {
  const iso = (d: Date) => format(d, "yyyy-MM-dd");
  const today = iso(from);
  switch (status) {
    case "Expired":
      return { lte: today };
    case "Critical":
      return { gt: today, lte: iso(addDays(from, 1)) };
    case "Urgent":
      return { gt: iso(addDays(from, 1)), lte: iso(addDays(from, 3)) };
    case "Warning":
      return { gt: iso(addDays(from, 3)), lte: iso(addDays(from, 7)) };
    case "Reminder":
      return { gt: iso(addDays(from, 7)), lte: iso(addDays(from, 15)) };
    case "Upcoming":
      return { gt: iso(addDays(from, 15)), lte: iso(addDays(from, 30)) };
    case "Safe":
      return { gt: iso(addDays(from, 30)) };
  }
}

/**
 * Domain Health indicator from spec section 11 (a coarser 5-bucket view
 * used for quick visual scanning, distinct from the 7-level notification
 * taxonomy above).
 */
export function getHealthLevel(daysLeft: number): HealthLevel {
  if (daysLeft <= 0) return "Expired";
  if (daysLeft < 7) return "Critical";
  if (daysLeft < 15) return "Warning";
  if (daysLeft <= 30) return "Attention";
  return "Healthy";
}

export const HEALTH_META: Record<HealthLevel, { emoji: string; label: string; description: string }> = {
  Healthy: { emoji: "🟢", label: "Healthy", description: "More than 30 days remaining" },
  Attention: { emoji: "🟡", label: "Attention Needed", description: "15-30 days remaining" },
  Warning: { emoji: "🟠", label: "Warning", description: "7-14 days remaining" },
  Critical: { emoji: "🔴", label: "Critical", description: "Less than 7 days remaining" },
  Expired: { emoji: "⚫", label: "Expired", description: "Expiry date has passed" },
};

export const STATUS_COLOR: Record<DomainStatus, { bg: string; text: string; dot: string; badge: string }> = {
  Safe: { bg: "bg-emerald-50 dark:bg-emerald-500/10", text: "text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-500", badge: "border-emerald-200 dark:border-emerald-500/30" },
  Upcoming: { bg: "bg-emerald-50 dark:bg-emerald-500/10", text: "text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-500", badge: "border-emerald-200 dark:border-emerald-500/30" },
  Reminder: { bg: "bg-amber-50 dark:bg-amber-500/10", text: "text-amber-700 dark:text-amber-400", dot: "bg-amber-500", badge: "border-amber-200 dark:border-amber-500/30" },
  Warning: { bg: "bg-amber-50 dark:bg-amber-500/10", text: "text-amber-700 dark:text-amber-400", dot: "bg-amber-500", badge: "border-amber-200 dark:border-amber-500/30" },
  Urgent: { bg: "bg-orange-50 dark:bg-orange-500/10", text: "text-orange-700 dark:text-orange-400", dot: "bg-orange-500", badge: "border-orange-200 dark:border-orange-500/30" },
  Critical: { bg: "bg-red-50 dark:bg-red-500/10", text: "text-red-700 dark:text-red-400", dot: "bg-red-500", badge: "border-red-200 dark:border-red-500/30" },
  Expired: { bg: "bg-gray-100 dark:bg-gray-500/10", text: "text-gray-600 dark:text-gray-400", dot: "bg-gray-500", badge: "border-gray-300 dark:border-gray-500/30" },
};

export function formatDate(dateStr: string, pattern = "d MMMM yyyy"): string {
  try {
    return format(parseISO(dateStr), pattern);
  } catch {
    return dateStr;
  }
}

export function daysRemainingLabel(daysLeft: number): string {
  if (daysLeft < 0) return `Expired ${Math.abs(daysLeft)} day${Math.abs(daysLeft) === 1 ? "" : "s"} ago`;
  if (daysLeft === 0) return "Expires today";
  return `${daysLeft} day${daysLeft === 1 ? "" : "s"} remaining`;
}

/** Renewing a domain always extends expiry by exactly one year from the
 * domain's *current* expiry date (industry-standard registrar behaviour),
 * not from today - so early renewals don't lose paid-for time. */
export function nextExpiryDateOnRenewal(currentExpiryDate: string): string {
  const current = parseISO(currentExpiryDate);
  return format(addYears(current, 1), "yyyy-MM-dd");
}

export const DOMAIN_CATEGORIES = [
  "Business",
  "Personal",
  "Portfolio",
  "College",
  "E-commerce",
  "Other",
] as const;

export type DomainCategory = (typeof DOMAIN_CATEGORIES)[number];

export const PAYMENT_METHODS = ["UPI", "Credit Card", "Debit Card", "Net Banking", "Wallet"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
