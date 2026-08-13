import { db } from "./db";
import { customers, domains, payments } from "./schema";
import { and, eq, sql } from "drizzle-orm";
import { newId } from "./ids";
import type { Customer } from "./schema";

export interface CustomerInput {
  fullName: string;
  username?: string;
  email?: string;
  phone?: string;
  company?: string;
  website?: string;
  notes?: string;
}

export interface FindOrCreateResult {
  customer: Customer;
  created: boolean;
  ambiguous?: Customer[];
}

/**
 * Auto-association logic for "NEW CORE FEATURE 4" — a customer should only
 * ever need to be created once. Priority order, matching the spec's "use a
 * sensible unique identifier such as email or GitHub username":
 *
 *   1. Caller already picked an existing customer (customerId) -> use it.
 *   2. Email given -> match an existing customer by email (case-insensitive).
 *   3. Username given -> match by username (case-insensitive).
 *   4. Neither given, but the full name exactly matches an existing
 *      customer -> that's genuinely ambiguous (could be the same person or
 *      a namesake), so we hand the candidate back to the caller instead of
 *      silently creating a duplicate or silently merging. The API layer
 *      surfaces this so the UI can ask the user to choose (spec: "ask the
 *      user to choose the existing customer instead of creating a
 *      duplicate"). Pass `force: true` to create anyway once the user has
 *      confirmed they mean a different person.
 *   5. Otherwise -> create a new customer.
 *
 * When we merge into an existing customer, any newly-supplied field that
 * was previously blank on that customer gets filled in (e.g. they didn't
 * have a phone number on file, now they do) - this lets a customer's
 * profile grow richer over time without ever overwriting data with blanks.
 */
export async function findOrCreateCustomer(
  userId: string,
  input: CustomerInput,
  opts: { customerId?: string; force?: boolean } = {},
): Promise<FindOrCreateResult> {
  if (opts.customerId) {
    const existing = await db.query.customers.findFirst({
      where: and(eq(customers.id, opts.customerId), eq(customers.userId, userId)),
    });
    if (existing) return { customer: existing, created: false };
    // Fall through to normal matching if the given id was invalid/stale.
  }

  const email = input.email?.trim().toLowerCase() ?? "";
  const username = input.username?.trim().toLowerCase() ?? "";
  const fullName = input.fullName.trim();

  let match: Customer | undefined;

  if (email) {
    match = await db.query.customers.findFirst({
      where: and(userIdEq(userId), sql`lower(${customers.email}) = ${email}`),
    });
  }
  if (!match && username) {
    match = await db.query.customers.findFirst({
      where: and(userIdEq(userId), sql`lower(${customers.username}) = ${username}`),
    });
  }

  if (match) {
    const patch: Partial<typeof customers.$inferInsert> = {};
    if (!match.phone && input.phone) patch.phone = input.phone.trim();
    if (!match.company && input.company) patch.company = input.company.trim();
    if (!match.website && input.website) patch.website = input.website.trim();
    if (!match.username && username) patch.username = username;
    if (!match.email && email) patch.email = email;
    if (Object.keys(patch).length > 0) {
      patch.updatedAt = new Date().toISOString();
      await db.update(customers).set(patch).where(eq(customers.id, match.id));
      match = { ...match, ...patch };
    }
    return { customer: match, created: false };
  }

  // No email/username to key off of - check for an exact full-name
  // collision so we don't silently fork one person into two records.
  if (!email && !username && !opts.force) {
    const nameMatch = await db.query.customers.findFirst({
      where: and(userIdEq(userId), sql`lower(${customers.fullName}) = ${fullName.toLowerCase()}`),
    });
    if (nameMatch) {
      return { customer: nameMatch, created: false, ambiguous: [nameMatch] };
    }
  }

  const id = newId("cust");
  await db.insert(customers).values({
    id,
    userId,
    fullName,
    username,
    email,
    phone: input.phone?.trim() ?? "",
    company: input.company?.trim() ?? "",
    website: input.website?.trim() ?? "",
    notes: input.notes?.trim() ?? "",
  });
  const created = await db.query.customers.findFirst({ where: eq(customers.id, id) });
  return { customer: created!, created: true };
}

function userIdEq(userId: string) {
  return eq(customers.userId, userId);
}

/** Aggregate stats for a single customer's domain portfolio (Feature 3). */
export async function getCustomerStats(userId: string, customerId: string) {
  const custDomains = await db.query.domains.findMany({ where: and(eq(domains.userId, userId), eq(domains.customerId, customerId)) });
  const custPayments = await db.query.payments.findMany({
    where: and(eq(payments.userId, userId), eq(payments.customerId, customerId)),
    orderBy: (p, { desc }) => [desc(p.date)],
  });
  return { domains: custDomains, payments: custPayments };
}
