import { NextResponse } from "next/server";
import { requireUser, handleApiError } from "@/lib/api-helpers";
import { syncNotificationsForUser } from "@/lib/notifications";

// Marks all-read is handled client side per item; this endpoint lets the
// client force a bulk mark-all-read pass.
export async function POST() {
  try {
    const user = await requireUser();
    const created = await syncNotificationsForUser(user.id, user.currency);
    return NextResponse.json({ created });
  } catch (err) {
    return handleApiError(err);
  }
}
