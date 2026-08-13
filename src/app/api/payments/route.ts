import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { payments } from "@/lib/schema";
import { and, eq, gte, lte, like, or, sql } from "drizzle-orm";
import { requireUser, handleApiError } from "@/lib/api-helpers";

/**
 * Paginated payment history (Feature 15 - performance), mirroring the same
 * pattern used for /api/domains and /api/customers: a dedicated Payments
 * page fetches page-by-page, while `all=true` remains available for
 * consumers (DataProvider, analytics, CSV export) that legitimately need
 * the whole set.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const sp = req.nextUrl.searchParams;
    const q = sp.get("q")?.trim().toLowerCase() ?? "";
    const method = sp.get("method") ?? "";
    const status = sp.get("status") ?? "";
    const from = sp.get("from") ?? "";
    const to = sp.get("to") ?? "";
    const all = sp.get("all") === "true";
    const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(sp.get("pageSize") ?? "20", 10) || 20));

    const conditions = [eq(payments.userId, user.id)];
    if (q) {
      conditions.push(
        or(
          like(sql`lower(${payments.domainNameSnapshot})`, `%${q}%`),
          like(sql`lower(${payments.transactionId})`, `%${q}%`),
        )!,
      );
    }
    if (method) conditions.push(eq(payments.method, method));
    if (status) conditions.push(eq(payments.status, status));
    if (from) conditions.push(gte(payments.date, from));
    if (to) conditions.push(lte(payments.date, to));
    const whereClause = and(...conditions);

    if (all) {
      const rows = await db.query.payments.findMany({
        where: whereClause,
        orderBy: (p, { desc }) => [desc(p.date)],
      });
      return NextResponse.json({ payments: rows, total: rows.length, page: 1, pageSize: rows.length });
    }

    const [rows, totalRow] = await Promise.all([
      db.query.payments.findMany({
        where: whereClause,
        orderBy: (p, { desc }) => [desc(p.date)],
        limit: pageSize,
        offset: (page - 1) * pageSize,
      }),
      db.select({ count: sql<number>`count(*)` }).from(payments).where(whereClause),
    ]);

    return NextResponse.json({ payments: rows, total: totalRow[0]?.count ?? 0, page, pageSize });
  } catch (err) {
    return handleApiError(err);
  }
}
