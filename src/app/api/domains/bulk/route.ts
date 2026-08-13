import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { domains, payments, customers } from "@/lib/schema";
import { and, eq, inArray } from "drizzle-orm";
import { requireUser, handleApiError, ApiError } from "@/lib/api-helpers";
import { bulkDomainActionSchema, firstZodError } from "@/lib/validations";
import { newId, generateTransactionId } from "@/lib/ids";
import { nextExpiryDateOnRenewal } from "@/lib/domain-utils";
import { createRenewalNotification } from "@/lib/notifications";
import { logActivity } from "@/lib/activity";
import { formatCurrency } from "@/lib/currency";

/**
 * Bulk domain actions (Feature 10). One request handles N domains instead
 * of the client firing N separate requests - both a UX convenience and a
 * real performance win (one round trip, one set of DB statements run in a
 * single pass instead of N page reloads worth of network overhead).
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const parsed = bulkDomainActionSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(firstZodError(parsed.error));
    }
    const { action, domainIds, customerId, method } = parsed.data;

    const owned = await db.query.domains.findMany({
      where: and(eq(domains.userId, user.id), inArray(domains.id, domainIds)),
    });
    if (owned.length === 0) {
      throw new ApiError("No matching domains found.", 404);
    }

    if (action === "delete") {
      await db.delete(domains).where(and(eq(domains.userId, user.id), inArray(domains.id, domainIds)));
      await logActivity(user.id, "domain_deleted", `Bulk deleted ${owned.length} domain(s)`, { type: "domain", id: "" });
      return NextResponse.json({ success: true, affected: owned.length });
    }

    if (action === "assignCustomer") {
      if (!customerId) throw new ApiError("Select a customer to assign.");
      const owner = await db.query.customers.findFirst({ where: eq(customers.id, customerId) });
      if (!owner || owner.userId !== user.id) throw new ApiError("Customer not found.", 404);

      await db
        .update(domains)
        .set({ customerId, updatedAt: new Date().toISOString() })
        .where(and(eq(domains.userId, user.id), inArray(domains.id, domainIds)));
      await logActivity(
        user.id,
        "domain_updated",
        `Assigned ${owned.length} domain(s) to ${owner.fullName}`,
        { type: "customer", id: customerId },
      );
      return NextResponse.json({ success: true, affected: owned.length });
    }

    if (action === "renew") {
      if (!method) throw new ApiError("Select a payment method.");
      let renewed = 0;
      let failed = 0;
      let totalAmount = 0;
      for (const domain of owned) {
        if (Math.random() < 0.04) {
          failed++;
          continue;
        }
        const owner = domain.customerId
          ? await db.query.customers.findFirst({ where: eq(customers.id, domain.customerId) })
          : null;
        const previousExpiryDate = domain.expiryDate;
        const newExpiryDate = nextExpiryDateOnRenewal(domain.expiryDate);
        const paymentId = newId("pay");
        await db.insert(payments).values({
          id: paymentId,
          userId: user.id,
          domainId: domain.id,
          domainNameSnapshot: domain.name,
          customerId: domain.customerId,
          customerNameSnapshot: owner?.fullName ?? "",
          transactionId: generateTransactionId(),
          amount: domain.renewalPrice,
          currency: user.currency,
          method,
          status: "Success",
          previousExpiryDate,
          newExpiryDate,
          date: new Date().toISOString(),
        });
        await db.update(domains).set({ expiryDate: newExpiryDate, updatedAt: new Date().toISOString() }).where(eq(domains.id, domain.id));
        await createRenewalNotification(user.id, domain.id, domain.name, newExpiryDate);
        renewed++;
        totalAmount += domain.renewalPrice;
      }
      if (renewed > 0) {
        await logActivity(
          user.id,
          "payment_recorded",
          `Bulk renewed ${renewed} domain(s) for ${formatCurrency(totalAmount, user.currency)}`,
          { type: "payment", id: "" },
        );
      }
      return NextResponse.json({ success: true, renewed, failed });
    }

    throw new ApiError("Unknown bulk action.");
  } catch (err) {
    return handleApiError(err);
  }
}
