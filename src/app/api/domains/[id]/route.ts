import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { domains, customers } from "@/lib/schema";
import { and, eq, ne } from "drizzle-orm";
import { domainSchema, firstZodError } from "@/lib/validations";
import { requireUser, handleApiError, ApiError } from "@/lib/api-helpers";
import { findOrCreateCustomer } from "@/lib/customers";
import { logActivity } from "@/lib/activity";

async function getOwnedDomain(userId: string, id: string) {
  const domain = await db.query.domains.findFirst({ where: eq(domains.id, id) });
  if (!domain || domain.userId !== userId) {
    throw new ApiError("Domain not found.", 404);
  }
  return domain;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const domain = await getOwnedDomain(user.id, params.id);
    const customer = domain.customerId
      ? await db.query.customers.findFirst({ where: eq(customers.id, domain.customerId) })
      : null;
    return NextResponse.json({ domain, customer });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const existing = await getOwnedDomain(user.id, params.id);

    const body = await req.json();
    const parsed = domainSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(firstZodError(parsed.error));
    }
    const data = parsed.data;

    const duplicate = await db.query.domains.findFirst({
      where: and(eq(domains.userId, user.id), eq(domains.name, data.name), ne(domains.id, params.id)),
    });
    if (duplicate) {
      throw new ApiError(`${data.name} is already in your domain list.`, 409);
    }

    let customerId: string | null = existing.customerId;
    if (data.customerId) {
      customerId = data.customerId;
    } else if (data.customer?.fullName) {
      const result = await findOrCreateCustomer(user.id, { fullName: data.customer.fullName, ...data.customer }, {
        force: data.forceNewCustomer,
      });
      if (result.ambiguous) {
        return NextResponse.json(
          {
            error: `A customer named "${data.customer.fullName}" already exists.`,
            ambiguous: true,
            candidates: result.ambiguous,
          },
          { status: 409 },
        );
      }
      customerId = result.customer.id;
    } else if (data.clearCustomer) {
      customerId = null;
    }

    await db
      .update(domains)
      .set({
        name: data.name,
        registrar: data.registrar,
        customerId,
        purchaseDate: data.purchaseDate,
        expiryDate: data.expiryDate,
        renewalPrice: data.renewalPrice,
        category: data.category,
        notes: data.notes ?? "",
        autoRenew: data.autoRenew ?? false,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(domains.id, params.id));

    const updated = await db.query.domains.findFirst({ where: eq(domains.id, params.id) });
    await logActivity(user.id, "domain_updated", `Domain updated: ${data.name}`, { type: "domain", id: params.id });

    return NextResponse.json({ domain: updated });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const existing = await getOwnedDomain(user.id, params.id);
    await db.delete(domains).where(eq(domains.id, params.id));
    await logActivity(user.id, "domain_deleted", `Domain deleted: ${existing.name}`, { type: "domain", id: params.id });
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err);
  }
}
