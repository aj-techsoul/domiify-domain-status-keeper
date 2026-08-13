import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { customers, domains, payments } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { requireUser, handleApiError, ApiError } from "@/lib/api-helpers";
import { toCsv } from "@/lib/csv";
import { daysRemaining, getDomainStatus } from "@/lib/domain-utils";

/** CSV export for customers/domains/payments (Feature 11). Streams a plain
 * CSV response - no client-side spreadsheet library needed. */
export async function GET(req: NextRequest, { params }: { params: { type: string } }) {
  try {
    const user = await requireUser();
    const ids = req.nextUrl.searchParams.get("ids")?.split(",").filter(Boolean);

    let csv: string;
    let filename: string;

    if (params.type === "customers") {
      const rows = await db.query.customers.findMany({ where: eq(customers.userId, user.id) });
      csv = toCsv(rows, [
        { key: "fullName", label: "Full Name" },
        { key: "username", label: "Username" },
        { key: "email", label: "Email" },
        { key: "phone", label: "Phone" },
        { key: "company", label: "Company" },
        { key: "website", label: "Website" },
        { key: "createdAt", label: "Created At" },
      ]);
      filename = "customers.csv";
    } else if (params.type === "domains") {
      let rows = await db.query.domains.findMany({ where: eq(domains.userId, user.id) });
      if (ids?.length) rows = rows.filter((r) => ids.includes(r.id));
      const custMap = new Map((await db.query.customers.findMany({ where: eq(customers.userId, user.id) })).map((c) => [c.id, c.fullName]));
      csv = toCsv(
        rows.map((d) => ({
          ...d,
          owner: d.customerId ? custMap.get(d.customerId) ?? "" : "",
          daysRemaining: daysRemaining(d.expiryDate),
          status: getDomainStatus(daysRemaining(d.expiryDate)),
        })),
        [
          { key: "name", label: "Domain" },
          { key: "owner", label: "Owner" },
          { key: "registrar", label: "Registrar" },
          { key: "category", label: "Category" },
          { key: "purchaseDate", label: "Purchase Date" },
          { key: "expiryDate", label: "Expiry Date" },
          { key: "daysRemaining", label: "Days Remaining" },
          { key: "status", label: "Status" },
          { key: "renewalPrice", label: "Renewal Price" },
        ],
      );
      filename = "domains.csv";
    } else if (params.type === "payments" || params.type === "renewals") {
      const rows = await db.query.payments.findMany({ where: eq(payments.userId, user.id), orderBy: (p, { desc }) => [desc(p.date)] });
      csv = toCsv(rows, [
        { key: "transactionId", label: "Transaction ID" },
        { key: "domainNameSnapshot", label: "Domain" },
        { key: "customerNameSnapshot", label: "Customer" },
        { key: "amount", label: "Amount" },
        { key: "currency", label: "Currency" },
        { key: "method", label: "Payment Method" },
        { key: "status", label: "Status" },
        { key: "previousExpiryDate", label: "Previous Expiry" },
        { key: "newExpiryDate", label: "New Expiry" },
        { key: "date", label: "Date" },
      ]);
      filename = "payments.csv";
    } else {
      throw new ApiError("Unknown export type.", 400);
    }

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
