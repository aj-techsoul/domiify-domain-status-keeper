import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { payments } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { requireUser, handleApiError, ApiError } from "@/lib/api-helpers";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const payment = await db.query.payments.findFirst({ where: eq(payments.id, params.id) });
    if (!payment || payment.userId !== user.id) {
      throw new ApiError("Payment record not found.", 404);
    }
    return NextResponse.json({ payment });
  } catch (err) {
    return handleApiError(err);
  }
}
