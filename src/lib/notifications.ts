import { db } from "./db";
import { domains, notifications, notificationPreferences } from "./schema";
import { and, eq } from "drizzle-orm";
import { newId } from "./ids";
import { daysRemaining } from "./domain-utils";
import { formatCurrency } from "./currency";

/**
 * Reminder thresholds from spec section 4. Each threshold is checked
 * independently (a domain can accumulate multiple notifications over time
 * as it gets closer to expiry), but we never create a duplicate
 * notification for the same domain + type pair.
 */
const THRESHOLDS: { days: number; type: string; prefKey: keyof typeof DEFAULT_PREFS }[] = [
  { days: 30, type: "Upcoming", prefKey: "notify30" },
  { days: 15, type: "Reminder", prefKey: "notify15" },
  { days: 7, type: "Warning", prefKey: "notify7" },
  { days: 3, type: "Urgent", prefKey: "notify3" },
  { days: 1, type: "Critical", prefKey: "notify1" },
];

const DEFAULT_PREFS = {
  notify30: true,
  notify15: true,
  notify7: true,
  notify3: true,
  notify1: true,
  notifyExpired: true,
};

function messageFor(type: string, domainName: string, daysLeft: number, price: number, currency: string): string {
  const cost = formatCurrency(price, currency);
  switch (type) {
    case "Upcoming":
      return `Your domain ${domainName} expires in ${daysLeft} days. Renewal cost: ${cost}.`;
    case "Reminder":
      return `Reminder: ${domainName} expires in ${daysLeft} days. Renewal cost: ${cost}.`;
    case "Warning":
      return `⚠️ Your domain ${domainName} expires in ${daysLeft} days. Renewal cost: ${cost}.`;
    case "Urgent":
      return `🔶 Urgent: ${domainName} expires in just ${daysLeft} days! Renew soon to avoid losing it.`;
    case "Critical":
      return `🔴 Critical: ${domainName} expires tomorrow! Renew now to avoid downtime.`;
    case "Expired":
      return `⚫ ${domainName} has expired. Renew immediately to prevent losing this domain.`;
    default:
      return `${domainName} status update.`;
  }
}

/**
 * Ensures notification records exist for every threshold a domain has
 * already crossed, for every domain owned by the user. Safe to call on
 * every dashboard/notifications page load - idempotent, only inserts what's
 * missing. This is how "Generate renewal reminders" (spec section 1, step 7
 * and section 4) is implemented without a background cron job.
 */
export async function syncNotificationsForUser(userId: string, currency = "INR") {
  const userDomains = await db.query.domains.findMany({ where: eq(domains.userId, userId) });

  const prefsRow = await db.query.notificationPreferences.findFirst({
    where: eq(notificationPreferences.userId, userId),
  });
  const prefs = prefsRow ?? DEFAULT_PREFS;

  const existing = await db.query.notifications.findMany({ where: eq(notifications.userId, userId) });
  const existingKeys = new Set(existing.map((n) => `${n.domainId}:${n.type}`));

  const toInsert: (typeof notifications.$inferInsert)[] = [];

  for (const domain of userDomains) {
    const daysLeft = daysRemaining(domain.expiryDate);

    for (const threshold of THRESHOLDS) {
      if (!prefs[threshold.prefKey]) continue;
      if (daysLeft > threshold.days) continue; // hasn't crossed this threshold yet
      if (daysLeft <= 0) continue; // expired domains get the "Expired" type instead
      const key = `${domain.id}:${threshold.type}`;
      if (existingKeys.has(key)) continue;

      toInsert.push({
        id: newId("notif"),
        userId,
        domainId: domain.id,
        domainNameSnapshot: domain.name,
        type: threshold.type,
        message: messageFor(threshold.type, domain.name, daysLeft, domain.renewalPrice, currency),
        read: false,
        date: new Date().toISOString(),
      });
      existingKeys.add(key);
    }

    if (daysLeft <= 0 && prefs.notifyExpired) {
      const key = `${domain.id}:Expired`;
      if (!existingKeys.has(key)) {
        toInsert.push({
          id: newId("notif"),
          userId,
          domainId: domain.id,
          domainNameSnapshot: domain.name,
          type: "Expired",
          message: messageFor("Expired", domain.name, daysLeft, domain.renewalPrice, currency),
          read: false,
          date: new Date().toISOString(),
        });
        existingKeys.add(key);
      }
    }
  }

  if (toInsert.length > 0) {
    await db.insert(notifications).values(toInsert);
  }

  return toInsert.length;
}

export async function createRenewalNotification(userId: string, domainId: string, domainName: string, newExpiryDate: string) {
  // Clear out the stale expiry-warning notifications for this domain now
  // that it has a fresh expiry date - they no longer apply and would
  // otherwise block future thresholds from re-firing next cycle.
  await db
    .delete(notifications)
    .where(
      and(
        eq(notifications.domainId, domainId),
        eq(notifications.userId, userId),
      ),
    );

  await db.insert(notifications).values({
    id: newId("notif"),
    userId,
    domainId,
    domainNameSnapshot: domainName,
    type: "Renewed",
    message: `✅ ${domainName} was renewed successfully. New expiry date: ${newExpiryDate}.`,
    read: false,
    date: new Date().toISOString(),
  });
}
