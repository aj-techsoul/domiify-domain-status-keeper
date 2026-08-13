import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { domains, customers } from "@/lib/schema";
import { and, eq, inArray, like, or, sql } from "drizzle-orm";
import { requireUser, handleApiError } from "@/lib/api-helpers";

/**
 * One smart search across domains AND customers (Feature 2). The caller
 * doesn't need to know which field matches - name, GitHub username, email,
 * phone, website, company, or domain name are all checked in a single pair
 * of indexed queries, capped at 8 results each so a broad query like "a"
 * can't return the whole table.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const raw = req.nextUrl.searchParams.get("q")?.trim() ?? "";
    const q = raw.toLowerCase();

    if (!q) {
      return NextResponse.json({ results: [], domains: [], customers: [] });
    }

    const [domainResults, customerResults] = await Promise.all([
      db.query.domains.findMany({
        where: and(eq(domains.userId, user.id), like(sql`lower(${domains.name})`, `%${q}%`)),
        orderBy: (d, { asc }) => [asc(d.expiryDate)],
        limit: 8,
      }),
      db.query.customers.findMany({
        where: and(
          eq(customers.userId, user.id),
          or(
            like(sql`lower(${customers.fullName})`, `%${q}%`),
            like(sql`lower(${customers.username})`, `%${q}%`),
            like(sql`lower(${customers.email})`, `%${q}%`),
            like(sql`lower(${customers.phone})`, `%${q}%`),
            like(sql`lower(${customers.company})`, `%${q}%`),
            like(sql`lower(${customers.website})`, `%${q}%`),
          ),
        ),
        orderBy: (c, { asc }) => [asc(c.fullName)],
        limit: 8,
      }),
    ]);

    // Also surface the domain(s) belonging to any matched customer, since
    // "searching a company should find all its domains" (spec example).
    const customerIds = customerResults.map((c) => c.id);
    const ownedDomains = customerIds.length
      ? await db.query.domains.findMany({
          where: and(eq(domains.userId, user.id), inArray(domains.customerId, customerIds)),
          limit: 20,
        })
      : [];

    return NextResponse.json({
      // Back-compat shape for the existing GlobalSearch component (domain-only results).
      results: domainResults,
      domains: domainResults,
      customers: customerResults.map((c) => ({
        ...c,
        domains: ownedDomains.filter((d) => d.customerId === c.id).map((d) => d.name),
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
