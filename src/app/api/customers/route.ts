import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { customers, domains } from "@/lib/schema";
import { and, eq, like, or, sql, desc, asc, inArray } from "drizzle-orm";
import { requireUser, handleApiError, ApiError } from "@/lib/api-helpers";
import { customerSchema, firstZodError } from "@/lib/validations";
import { findOrCreateCustomer } from "@/lib/customers";
import { logActivity } from "@/lib/activity";

/**
 * Paginated, searchable customer list (Feature 2/15). Filtering and paging
 * happen in SQL against the indexed columns rather than pulling every
 * customer into Node and filtering in memory - this is the piece that keeps
 * the Customers page fast as the list grows.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const sp = req.nextUrl.searchParams;
    const q = sp.get("q")?.trim().toLowerCase() ?? "";
    const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(sp.get("pageSize") ?? "20", 10) || 20));
    const sort = sp.get("sort") ?? "name-asc";

    const whereClause = q
      ? and(
          eq(customers.userId, user.id),
          or(
            like(sql`lower(${customers.fullName})`, `%${q}%`),
            like(sql`lower(${customers.username})`, `%${q}%`),
            like(sql`lower(${customers.email})`, `%${q}%`),
            like(sql`lower(${customers.company})`, `%${q}%`),
            like(sql`lower(${customers.website})`, `%${q}%`),
          ),
        )
      : eq(customers.userId, user.id);

    const orderBy =
      sort === "name-desc"
        ? desc(customers.fullName)
        : sort === "newest"
          ? desc(customers.createdAt)
          : asc(customers.fullName);

    const [rows, totalRow] = await Promise.all([
      db.query.customers.findMany({
        where: whereClause,
        orderBy: (_c, ops) => [orderBy ?? ops.asc(customers.fullName)],
        limit: pageSize,
        offset: (page - 1) * pageSize,
      }),
      db.select({ count: sql<number>`count(*)` }).from(customers).where(whereClause),
    ]);

    // Domain counts per returned customer, in one grouped query instead of
    // N+1 per-row lookups.
    const ids = rows.map((r) => r.id);
    const counts = ids.length
      ? await db
          .select({ customerId: domains.customerId, count: sql<number>`count(*)` })
          .from(domains)
          .where(and(eq(domains.userId, user.id), inArray(domains.customerId, ids)))
          .groupBy(domains.customerId)
      : [];
    const countMap = new Map(counts.map((c) => [c.customerId, c.count]));

    return NextResponse.json({
      customers: rows.map((c) => ({ ...c, domainCount: countMap.get(c.id) ?? 0 })),
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
    const parsed = customerSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(firstZodError(parsed.error));
    }

    const force = body.force === true;
    const result = await findOrCreateCustomer(user.id, parsed.data, { force });

    if (result.ambiguous) {
      return NextResponse.json(
        {
          error: `A customer named "${parsed.data.fullName}" already exists.`,
          ambiguous: true,
          candidates: result.ambiguous,
        },
        { status: 409 },
      );
    }

    if (result.created) {
      await logActivity(user.id, "customer_created", `New customer added: ${result.customer.fullName}`, {
        type: "customer",
        id: result.customer.id,
      });
    }

    return NextResponse.json({ customer: result.customer, created: result.created }, { status: result.created ? 201 : 200 });
  } catch (err) {
    return handleApiError(err);
  }
}
