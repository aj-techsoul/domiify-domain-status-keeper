import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { domains, payments, customers } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { renewSchema, firstZodError } from "@/lib/validations";
import { requireUser, handleApiError, ApiError } from "@/lib/api-helpers";
import { newId, generateTransactionId } from "@/lib/ids";
import { nextExpiryDateOnRenewal } from "@/lib/domain-utils";
import { createRenewalNotification } from "@/lib/notifications";
import { logActivity } from "@/lib/activity";
import { formatCurrency } from "@/lib/currency";

/**
 * Simulated renewal/payment flow (spec sections 5 & 6). This is a DEMO
 * payment: no real money moves and no payment gateway is contacted. A tiny
 * random-failure chance is included so the "failed payment" error-handling
 * path (spec section 20) is demonstrable, matching how a real gateway
 * integration would behave.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const domain = await db.query.domains.findFirst({ where: eq(domains.id, params.id) });

    if (!domain || domain.userId !== user.id) {
      throw new ApiError("Domain not found.", 404);
    }

    const body = await req.json().catch(() => ({}));
    const parsed = renewSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(firstZodError(parsed.error));
    }

    const owner = domain.customerId
      ? await db.query.customers.findFirst({ where: eq(customers.id, domain.customerId) })
      : null;

    // Simulate an occasional gateway decline (~4% of the time) so the
    // failure UI path is real and demonstrable, not just theoretical.
    const simulatedFailure = Math.random() < 0.04;

    if (simulatedFailure) {
      await db.insert(payments).values({
        id: newId("pay"),
        userId: user.id,
        domainId: domain.id,
        domainNameSnapshot: domain.name,
        customerId: domain.customerId,
        customerNameSnapshot: owner?.fullName ?? "",
        transactionId: generateTransactionId(),
        amount: domain.renewalPrice,
        currency: user.currency,
        method: parsed.data.method,
        status: "Failed",
        previousExpiryDate: domain.expiryDate,
        newExpiryDate: domain.expiryDate,
        date: new Date().toISOString(),
      });
      throw new ApiError(
        "Payment could not be processed by the (simulated) payment gateway. No charge was made — please try again.",
        402,
      );
    }

    const previousExpiryDate = domain.expiryDate;
    const newExpiryDate = nextExpiryDateOnRenewal(domain.expiryDate);
    const transactionId = generateTransactionId();
    const paymentId = newId("pay");

    await db.insert(payments).values({
      id: paymentId,
      userId: user.id,
      domainId: domain.id,
      domainNameSnapshot: domain.name,
      customerId: domain.customerId,
      customerNameSnapshot: owner?.fullName ?? "",
      transactionId,
      amount: domain.renewalPrice,
      currency: user.currency,
      method: parsed.data.method,
      status: "Success",
      renewalPeriodYears: 1,
      previousExpiryDate,
      newExpiryDate,
      date: new Date().toISOString(),
    });

    await db
      .update(domains)
      .set({ expiryDate: newExpiryDate, updatedAt: new Date().toISOString() })
      .where(eq(domains.id, domain.id));

    await createRenewalNotification(user.id, domain.id, domain.name, newExpiryDate);
    await logActivity(
      user.id,
      "payment_recorded",
      `${owner ? owner.fullName + " renewed" : "Renewed"} ${domain.name} for ${formatCurrency(domain.renewalPrice, user.currency)}`,
      { type: "payment", id: paymentId },
    );

    const payment = await db.query.payments.findFirst({ where: eq(payments.id, paymentId) });

    return NextResponse.json({ payment, newExpiryDate }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
