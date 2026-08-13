import { db } from "./db";
import { activityLogs } from "./schema";
import { eq } from "drizzle-orm";
import { newId } from "./ids";

export type ActivityType =
  | "customer_created"
  | "customer_updated"
  | "customer_deleted"
  | "domain_created"
  | "domain_updated"
  | "domain_deleted"
  | "domain_renewed"
  | "payment_recorded";

/** Records one row in the activity/audit log (Feature 12). Fire-and-forget
 * from the caller's perspective - failures here should never break the
 * primary action, so callers can just `await` it inline without wrapping
 * in try/catch (errors are swallowed and logged server-side only). */
export async function logActivity(
  userId: string,
  type: ActivityType,
  message: string,
  entity?: { type: "customer" | "domain" | "payment"; id: string },
) {
  try {
    await db.insert(activityLogs).values({
      id: newId("act"),
      userId,
      type,
      message,
      entityType: entity?.type ?? "",
      entityId: entity?.id ?? "",
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Failed to record activity log:", err);
  }
}

export async function getRecentActivity(userId: string, limit = 10) {
  return db.query.activityLogs.findMany({
    where: eq(activityLogs.userId, userId),
    orderBy: (a, { desc }) => [desc(a.createdAt)],
    limit,
  });
}
