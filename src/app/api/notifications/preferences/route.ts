import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notificationPreferences } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { requireUser, handleApiError, ApiError } from "@/lib/api-helpers";
import { notificationPreferencesSchema, firstZodError } from "@/lib/validations";

export async function GET() {
  try {
    const user = await requireUser();
    let prefs = await db.query.notificationPreferences.findFirst({
      where: eq(notificationPreferences.userId, user.id),
    });
    if (!prefs) {
      await db.insert(notificationPreferences).values({ userId: user.id });
      prefs = await db.query.notificationPreferences.findFirst({
        where: eq(notificationPreferences.userId, user.id),
      });
    }
    return NextResponse.json({ preferences: prefs });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const parsed = notificationPreferencesSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(firstZodError(parsed.error));
    }

    const existing = await db.query.notificationPreferences.findFirst({
      where: eq(notificationPreferences.userId, user.id),
    });

    if (existing) {
      await db.update(notificationPreferences).set(parsed.data).where(eq(notificationPreferences.userId, user.id));
    } else {
      await db.insert(notificationPreferences).values({ userId: user.id, ...parsed.data });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err);
  }
}
