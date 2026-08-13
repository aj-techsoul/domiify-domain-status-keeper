import { NextRequest, NextResponse } from "next/server";
import { requireUser, handleApiError } from "@/lib/api-helpers";
import { getRecentActivity } from "@/lib/activity";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const limit = Math.min(50, Math.max(1, parseInt(req.nextUrl.searchParams.get("limit") ?? "10", 10) || 10));
    const activity = await getRecentActivity(user.id, limit);
    return NextResponse.json({ activity });
  } catch (err) {
    return handleApiError(err);
  }
}
