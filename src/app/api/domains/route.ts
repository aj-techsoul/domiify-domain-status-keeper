import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { domains, customers } from "@/lib/schema";
import { and, eq, gt, lte, like, sql, asc, desc, inArray } from "drizzle-orm";
import { domainSchema, firstZodError } from "@/lib/validations";
import { newId } from "@/lib/ids";
import { requireUser, handleApiError, ApiError } from "@/lib/api-helpers";
import { findOrCreateCustomer } from "@/lib/customers";
import { logActivity } from "@/lib/activity";
import { getStatusDateBounds, DomainStatus } from "@/lib/domain-utils";

const STATUS_VALUES: DomainStatus[] = ["Safe", "Upcoming", "Reminder", "Warning", "Urgent", "Critical", "Expired"];

/**
 * Paginated, server-filtered domain list (Feature 15 - performance).
 *
 * Perf note: this route used to also call `syncNotificationsForUser` on
 * every request, which ran a handful of extra queries even when the caller
 * only wanted the domain table (e.g. the Domains page, the bulk-action
 * picker, CSV export). That coupling was removed - reminder syncing now
 * happens only from the notifications endpoints, where it belongs.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const sp = req.nextUrl.searchParams;
    const q = sp.get("q")?.trim().toLowerCase() ?? "";
    const category = sp.get("category") ?? "";
    const status = sp.get("status") as DomainStatus | "";
    const customerId = sp.get("customerId") ?? "";
    const sort = sp.get("sort") ?? "expiry-asc";
    const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(sp.get("pageSize") ?? "20", 10) || 20));
    const all = sp.get("all") === "true"; // escape hatch for components that need the full list (renew modal lookups, calendar)

    const conditions = [eq(domains.userId, user.id)];
    if (q) conditions.push(like(sql`lower(${domains.name})`, `%${q}%`));
    if (category) conditions.push(eq(domains.category, category));
    if (customerId) conditions.push(eq(domains.customerId, customerId));
    if (status && STATUS_VALUES.includes(status)) {
      const bounds = getStatusDateBounds(status);
      if (bounds.gt) conditions.push(gt(domains.expiryDate, bounds.gt));
      if (bounds.lte) conditions.push(lte(domains.expiryDate, bounds.lte));
    }
    const whereClause = and(...conditions);

    const orderBy =
      sort === "expiry-desc"
        ? desc(domains.expiryDate)
        : sort === "price-desc"
          ? desc(domains.renewalPrice)
          : sort === "price-asc"
            ? asc(domains.renewalPrice)
            : sort === "name-asc"
              ? asc(domains.name)
              : asc(domains.expiryDate);

    if (all) {
      const rows = await db.query.domains.findMany({ where: whereClause, orderBy: () => [orderBy] });
      return NextResponse.json({ domains: rows, total: rows.length, page: 1, pageSize: rows.length });
    }

    const [rows, totalRow] = await Promise.all([
      db.query.domains.findMany({
        where: whereClause,
        orderBy: () => [orderBy],
        limit: pageSize,
        offset: (page - 1) * pageSize,
      }),
      db.select({ count: sql<number>`count(*)` }).from(domains).where(whereClause),
    ]);

    // Owner name for each returned row, one grouped lookup instead of N+1.
    const customerIds = Array.from(new Set(rows.map((r) => r.customerId).filter((id): id is string => !!id)));
    const owners = customerIds.length
      ? await db.query.customers.findMany({ where: inArray(customers.id, customerIds) })
      : [];
    const ownerMap = new Map(owners.map((o) => [o.id, o]));

    return NextResponse.json({
      domains: rows.map((d) => ({ ...d, customer: d.customerId ? ownerMap.get(d.customerId) ?? null : null })),
      total: totalRow[0]?.count ?? 0,
      page,
      pageSize,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const parsed = domainSchema.safeParse(body);

    if (!parsed.success) {
      throw new ApiError(firstZodError(parsed.error));
    }

    const data = parsed.data;

    const duplicate = await db.query.domains.findFirst({
      where: and(eq(domains.userId, user.id), eq(domains.name, data.name)),
    });
    if (duplicate) {
      throw new ApiError(`${data.name} is already in your domain list.`, 409);
    }

    // Feature 4: auto-associate with an existing customer, or create one
    // inline, without ever silently duplicating a person.
    let customerId: string | undefined = data.customerId;
    if (!customerId && data.customer?.fullName) {
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
      if (result.created) {
        await logActivity(user.id, "customer_created", `New customer added: ${result.customer.fullName}`, {
          type: "customer",
          id: result.customer.id,
        });
      }
    }

    const id = newId("dom");
    await db.insert(domains).values({
      id,
      userId: user.id,
      customerId: customerId ?? null,
      name: data.name,
      registrar: data.registrar,
      purchaseDate: data.purchaseDate,
      expiryDate: data.expiryDate,
      renewalPrice: data.renewalPrice,
      category: data.category,
      notes: data.notes ?? "",
      autoRenew: data.autoRenew ?? false,
    });

    const created = await db.query.domains.findFirst({ where: eq(domains.id, id) });
    await logActivity(user.id, "domain_created", `New domain added: ${data.name}`, { type: "domain", id });

    return NextResponse.json({ domain: created }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
