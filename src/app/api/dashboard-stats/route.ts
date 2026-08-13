import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { domains, payments, customers } from "@/lib/schema";
import { eq, sql, gt, lte, and, desc } from "drizzle-orm";
import { requireUser, handleApiError } from "@/lib/api-helpers";
import { format, addDays, startOfMonth } from "date-fns";

/**
 * One aggregate-query endpoint backing the whole dashboard (Feature 8/15).
 * Everything here is COUNT/SUM/GROUP BY done in SQLite, not "fetch every
 * domain/payment row and reduce() in JS" - the dashboard used to do the
 * latter by reading the full arrays out of DataProvider, which meant every
 * dashboard load paid for the entire table's data transfer even though it
 * only needed a handful of numbers.
 */
export async function GET() {
  try {
    const user = await requireUser();
    const uid = user.id;
    const today = format(new Date(), "yyyy-MM-dd");
    const in30 = format(addDays(new Date(), 30), "yyyy-MM-dd");
    const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");

    const [
      totalDomains,
      totalCustomers,
      activeDomains,
      expiringSoon,
      expiredDomains,
      revenueRow,
      renewalsThisMonthRow,
      recentPayments,
      multiDomainCustomers,
    ] = await Promise.all([
      db.select({ c: sql<number>`count(*)` }).from(domains).where(eq(domains.userId, uid)),
      db.select({ c: sql<number>`count(*)` }).from(customers).where(eq(customers.userId, uid)),
      db.select({ c: sql<number>`count(*)` }).from(domains).where(and(eq(domains.userId, uid), gt(domains.expiryDate, today))),
      db
        .select({ c: sql<number>`count(*)` })
        .from(domains)
        .where(and(eq(domains.userId, uid), gt(domains.expiryDate, today), lte(domains.expiryDate, in30))),
      db.select({ c: sql<number>`count(*)` }).from(domains).where(and(eq(domains.userId, uid), lte(domains.expiryDate, today))),
      db
        .select({ total: sql<number>`coalesce(sum(${payments.amount}), 0)` })
        .from(payments)
        .where(and(eq(payments.userId, uid), eq(payments.status, "Success"))),
      db
        .select({ c: sql<number>`count(*)`, total: sql<number>`coalesce(sum(${payments.amount}), 0)` })
        .from(payments)
        .where(and(eq(payments.userId, uid), eq(payments.status, "Success"), gt(payments.date, monthStart))),
      db.query.payments.findMany({
        where: and(eq(payments.userId, uid), eq(payments.status, "Success")),
        orderBy: (p, { desc: d }) => [d(p.date)],
        limit: 5,
      }),
      db
        .select({ customerId: domains.customerId, count: sql<number>`count(*)`.as("count") })
        .from(domains)
        .where(eq(domains.userId, uid))
        .groupBy(domains.customerId)
        .having(sql`count(*) > 1`)
        .orderBy(desc(sql`count(*)`))
        .limit(5),
    ]);

    const multiCustomerIds = multiDomainCustomers.map((r) => r.customerId).filter((id): id is string => !!id);
    const multiCustomers = multiCustomerIds.length
      ? await db.query.customers.findMany({ where: (c, { inArray }) => inArray(c.id, multiCustomerIds) })
      : [];
    const multiCountMap = new Map(multiDomainCustomers.map((r) => [r.customerId, r.count]));

    return NextResponse.json({
      totalDomains: totalDomains[0]?.c ?? 0,
      totalCustomers: totalCustomers[0]?.c ?? 0,
      activeDomains: activeDomains[0]?.c ?? 0,
      expiringSoon: expiringSoon[0]?.c ?? 0,
      expiredDomains: expiredDomains[0]?.c ?? 0,
      revenue: revenueRow[0]?.total ?? 0,
      renewalsThisMonth: renewalsThisMonthRow[0]?.c ?? 0,
      renewalsThisMonthRevenue: renewalsThisMonthRow[0]?.total ?? 0,
      recentPayments,
      recentlyRenewed: recentPayments,
      multiDomainCustomers: multiCustomers.map((c) => ({ ...c, domainCount: multiCountMap.get(c.id) ?? 0 })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
