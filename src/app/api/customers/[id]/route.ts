import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { customers } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { requireUser, handleApiError, ApiError } from "@/lib/api-helpers";
import { customerSchema, firstZodError } from "@/lib/validations";
import { getCustomerStats } from "@/lib/customers";
import { logActivity } from "@/lib/activity";

async function getOwnedCustomer(userId: string, id: string) {
  const customer = await db.query.customers.findFirst({ where: eq(customers.id, id) });
  if (!customer || customer.userId !== userId) {
    throw new ApiError("Customer not found.", 404);
  }
  return customer;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const customer = await getOwnedCustomer(user.id, params.id);
    const { domains: custDomains, payments: custPayments } = await getCustomerStats(user.id, customer.id);
    return NextResponse.json({ customer, domains: custDomains, payments: custPayments });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    await getOwnedCustomer(user.id, params.id);

    const body = await req.json();
    const parsed = customerSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(firstZodError(parsed.error));
    }

    await db
      .update(customers)
      .set({ ...parsed.data, updatedAt: new Date().toISOString() })
      .where(eq(customers.id, params.id));

    const updated = await db.query.customers.findFirst({ where: eq(customers.id, params.id) });
    await logActivity(user.id, "customer_updated", `Customer updated: ${updated!.fullName}`, {
      type: "customer",
      id: params.id,
    });

    return NextResponse.json({ customer: updated });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const customer = await getOwnedCustomer(user.id, params.id);

    // Domains aren't deleted with their customer - they just become
    // unowned (customerId set null via the FK's onDelete: "set null"), so
    // deleting a customer never silently destroys domain/payment history.
    await db.delete(customers).where(eq(customers.id, params.id));
    await logActivity(user.id, "customer_deleted", `Customer deleted: ${customer.fullName}`, {
      type: "customer",
      id: params.id,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err);
  }
}
