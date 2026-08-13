import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { domains, payments } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { requireUser, handleApiError } from "@/lib/api-helpers";
import { daysRemaining } from "@/lib/domain-utils";
import { format, parseISO, subMonths } from "date-fns";

export async function GET() {
  try {
    const user = await requireUser();

    const allDomains = await db.query.domains.findMany({ where: eq(domains.userId, user.id) });
    const allPayments = await db.query.payments.findMany({
      where: eq(payments.userId, user.id),
      orderBy: (p, { asc }) => [asc(p.date)],
    });
    const successfulPayments = allPayments.filter((p) => p.status === "Success");

    const totalDomains = allDomains.length;
    const totalSpent = successfulPayments.reduce((sum, p) => sum + p.amount, 0);
    const averageRenewalCost = successfulPayments.length ? totalSpent / successfulPayments.length : 0;

    const upcomingCost = allDomains
      .filter((d) => daysRemaining(d.expiryDate) <= 60 && daysRemaining(d.expiryDate) > 0)
      .reduce((sum, d) => sum + d.renewalPrice, 0);

    // Monthly spending for the trailing 12 months, oldest first.
    const now = new Date();
    const monthly: { month: string; total: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const monthDate = subMonths(now, i);
      const key = format(monthDate, "MMM yyyy");
      monthly.push({ month: key, total: 0 });
    }
    for (const p of successfulPayments) {
      const key = format(parseISO(p.date.slice(0, 10)), "MMM yyyy");
      const bucket = monthly.find((m) => m.month === key);
      if (bucket) bucket.total += p.amount;
    }

    const categoryBreakdown: Record<string, number> = {};
    for (const d of allDomains) {
      categoryBreakdown[d.category] = (categoryBreakdown[d.category] ?? 0) + 1;
    }

    const mostExpensive = [...allDomains]
      .sort((a, b) => b.renewalPrice - a.renewalPrice)
      .slice(0, 5)
      .map((d) => ({ name: d.name, price: d.renewalPrice, category: d.category }));

    return NextResponse.json({
      totalDomains,
      totalSpent,
      averageRenewalCost,
      upcomingCost,
      monthlySpending: monthly,
      categoryBreakdown: Object.entries(categoryBreakdown).map(([category, count]) => ({ category, count })),
      mostExpensive,
      totalPayments: successfulPayments.length,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
