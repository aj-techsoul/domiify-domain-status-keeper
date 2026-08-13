import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { domains, customers } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { requireUser, handleApiError, ApiError } from "@/lib/api-helpers";
import { logActivity } from "@/lib/activity";

/** Lightweight "Change Owner" action from the domain detail page (Feature 9) -
 * just repoints customerId without re-validating the whole domain form. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const domain = await db.query.domains.findFirst({ where: eq(domains.id, params.id) });
    if (!domain || domain.userId !== user.id) {
      throw new ApiError("Domain not found.", 404);
    }

    const body = await req.json().catch(() => ({}));
    const customerId: string | null = body.customerId || null;

    if (customerId) {
      const owner = await db.query.customers.findFirst({ where: eq(customers.id, customerId) });
      if (!owner || owner.userId !== user.id) {
        throw new ApiError("Customer not found.", 404);
      }
    }

    await db.update(domains).set({ customerId, updatedAt: new Date().toISOString() }).where(eq(domains.id, params.id));
    await logActivity(user.id, "domain_updated", `Owner changed for ${domain.name}`, { type: "domain", id: params.id });

    const updated = await db.query.domains.findFirst({ where: eq(domains.id, params.id) });
    return NextResponse.json({ domain: updated });
  } catch (err) {
    return handleApiError(err);
  }
}
