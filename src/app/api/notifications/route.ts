import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notifications } from "@/lib/schema";
import { and, eq } from "drizzle-orm";
import { requireUser, handleApiError } from "@/lib/api-helpers";
import { syncNotificationsForUser } from "@/lib/notifications";

export async function GET() {
  try {
    const user = await requireUser();
    await syncNotificationsForUser(user.id, user.currency);
    const rows = await db.query.notifications.findMany({
      where: and(eq(notifications.userId, user.id), eq(notifications.dismissed, false)),
      orderBy: (n, { desc }) => [desc(n.date)],
    });
    return NextResponse.json({ notifications: rows });
  } catch (err) {
    return handleApiError(err);
  }
}
