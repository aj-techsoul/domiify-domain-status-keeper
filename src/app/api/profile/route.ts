import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { requireUser, handleApiError, ApiError } from "@/lib/api-helpers";
import { profileSchema, firstZodError } from "@/lib/validations";

export async function PUT(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const parsed = profileSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(firstZodError(parsed.error));
    }

    await db
      .update(users)
      .set({ name: parsed.data.name, currency: parsed.data.currency })
      .where(eq(users.id, user.id));

    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err);
  }
}
