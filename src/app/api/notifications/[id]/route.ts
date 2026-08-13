import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notifications } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { requireUser, handleApiError, ApiError } from "@/lib/api-helpers";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const notif = await db.query.notifications.findFirst({ where: eq(notifications.id, params.id) });
    if (!notif || notif.userId !== user.id) {
      throw new ApiError("Notification not found.", 404);
    }
    const body = await req.json().catch(() => ({}));
    const read = typeof body.read === "boolean" ? body.read : true;

    await db.update(notifications).set({ read }).where(eq(notifications.id, params.id));
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const notif = await db.query.notifications.findFirst({ where: eq(notifications.id, params.id) });
    if (!notif || notif.userId !== user.id) {
      throw new ApiError("Notification not found.", 404);
    }
    // Soft delete: syncNotificationsForUser dedups on "does a row already
    // exist for this domainId:type", so a hard delete here would just get
    // silently recreated the next time that endpoint runs (e.g. the very
    // refresh this action triggers). Marking it dismissed keeps the row in
    // place to satisfy that check while excluding it from every list the
    // UI reads from.
    await db.update(notifications).set({ dismissed: true, read: true }).where(eq(notifications.id, params.id));
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err);
  }
}
