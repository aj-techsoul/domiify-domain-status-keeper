/**
 * Seeds the database with a demo user and realistic demo data so Domiify
 * looks populated on first launch (spec section 17).
 *
 * Run with: npm run db:seed
 */
import "dotenv/config";
import { db, sqlite } from "../src/lib/db";
import { users, domains, payments, customers, notificationPreferences } from "../src/lib/schema";
import { newId, generateTransactionId } from "../src/lib/ids";
import { hashPassword } from "../src/lib/auth";
import { logActivity } from "../src/lib/activity";
import { format, addDays, subDays, subYears } from "date-fns";
import { eq } from "drizzle-orm";

async function main() {
  const demoEmail = "demo@domiify.app";

  const existing = await db.query.users.findFirst({ where: eq(users.email, demoEmail) });
  if (existing) {
    console.log("Demo user already exists, skipping seed. (Delete domiify.db to reseed from scratch.)");
    return;
  }

  const userId = newId("user");
  const passwordHash = await hashPassword("Demo@1234");
  const today = new Date();

  await db.insert(users).values({
    id: userId,
    name: "Demo User",
    email: demoEmail,
    passwordHash,
    currency: "INR",
    theme: "system",
  });

  await db.insert(notificationPreferences).values({ userId });

  const fmt = (d: Date) => format(d, "yyyy-MM-dd");

  // Demo customers (Domiify 2.0) - a deliberately varied mix: some with
  // full contact details, one company account, one identified only by a
  // username, so every field the Customers page can display has at least
  // one real example. Two of these intentionally own more than one domain
  // so the dashboard's "Top Customers by Domains" widget has something to
  // show immediately.
  const customerSeed = [
    { fullName: "Priya Sharma", username: "priyasharma", email: "priya.sharma@example.com", phone: "+91 98765 43210", company: "Acme Consulting", website: "https://priyasharma.dev" },
    { fullName: "Arjun Mehta", username: "", email: "arjun.mehta@gmail.com", phone: "", company: "", website: "" },
    { fullName: "Tenobusiness Pvt Ltd", username: "", email: "contact@tenobusiness.in", phone: "+91 80123 45678", company: "Tenobusiness Pvt Ltd", website: "https://tenobusiness.in" },
    { fullName: "Rohan Kapoor", username: "rohank", email: "", phone: "+91 99887 76655", company: "", website: "" },
    { fullName: "Ananya Iyer", username: "", email: "ananya.iyer@college.edu", phone: "", company: "", website: "" },
  ];

  const createdCustomers = [];
  for (const c of customerSeed) {
    const id = newId("cust");
    await db.insert(customers).values({ id, userId, ...c });
    createdCustomers.push({ id, ...c });
    await logActivity(userId, "customer_created", `New customer added: ${c.fullName}`, { type: "customer", id });
  }

  // A realistic, varied spread of domains: some safe, some expiring soon,
  // one expired, across every category - so every dashboard state has
  // something to show immediately. `customerIndex` points into
  // `createdCustomers`; two are left unset so the "Unassigned" state is
  // also visible on first launch.
  const domainSeed = [
    {
      name: "example.com",
      registrar: "GoDaddy",
      purchaseDate: fmt(subYears(today, 3)),
      expiryDate: fmt(addDays(today, 39)),
      renewalPrice: 999,
      category: "Business",
      notes: "Primary marketing site.",
      customerIndex: 0,
    },
    {
      name: "myportfolio.dev",
      registrar: "Namecheap",
      purchaseDate: fmt(subYears(today, 1)),
      expiryDate: fmt(addDays(today, 7)),
      renewalPrice: 899,
      category: "Portfolio",
      notes: "Personal portfolio and resume site.",
      customerIndex: 1,
    },
    {
      name: "tenobusiness.in",
      registrar: "BigRock",
      purchaseDate: fmt(subYears(today, 2)),
      expiryDate: fmt(addDays(today, 3)),
      renewalPrice: 649,
      category: "Business",
      notes: "Client-facing business domain.",
      customerIndex: 2,
    },
    {
      name: "myshop.store",
      registrar: "GoDaddy",
      purchaseDate: fmt(subYears(today, 1)),
      expiryDate: fmt(addDays(today, 120)),
      renewalPrice: 1499,
      category: "E-commerce",
      notes: "Online storefront, Shopify-hosted.",
      customerIndex: 3,
    },
    {
      name: "collegeproject.tech",
      registrar: "Namecheap",
      purchaseDate: fmt(subDays(today, 300)),
      expiryDate: fmt(addDays(today, 1)),
      renewalPrice: 399,
      category: "College",
      notes: "Final year capstone project deployment.",
      customerIndex: 4,
    },
    {
      name: "familyblog.online",
      registrar: "Hostinger",
      purchaseDate: fmt(subYears(today, 4)),
      expiryDate: fmt(subDays(today, 5)),
      renewalPrice: 549,
      category: "Personal",
      notes: "Old family blog, needs renewal.",
      customerIndex: undefined,
    },
    {
      name: "startupidea.co",
      registrar: "GoDaddy",
      purchaseDate: fmt(subDays(today, 200)),
      expiryDate: fmt(addDays(today, 210)),
      renewalPrice: 2199,
      category: "Business",
      notes: "Reserved for an upcoming startup launch.",
      customerIndex: 0,
    },
    {
      name: "notesvault.info",
      registrar: "Namecheap",
      purchaseDate: fmt(subYears(today, 1)),
      expiryDate: fmt(addDays(today, 15)),
      renewalPrice: 299,
      category: "Personal",
      notes: "Private notes and bookmarks app.",
      customerIndex: 3,
    },
    {
      name: "designstudio.art",
      registrar: "Google Domains",
      purchaseDate: fmt(subDays(today, 500)),
      expiryDate: fmt(addDays(today, 365)),
      renewalPrice: 1799,
      category: "Portfolio",
      notes: "Design agency showcase.",
      customerIndex: undefined,
    },
  ];

  const createdDomains = [];
  for (const d of domainSeed) {
    const id = newId("dom");
    const owner = d.customerIndex !== undefined ? createdCustomers[d.customerIndex] : undefined;
    await db.insert(domains).values({
      id,
      userId,
      customerId: owner?.id ?? null,
      name: d.name,
      registrar: d.registrar,
      purchaseDate: d.purchaseDate,
      expiryDate: d.expiryDate,
      renewalPrice: d.renewalPrice,
      category: d.category,
      notes: d.notes,
      autoRenew: false,
    });
    createdDomains.push({ id, owner, ...d });
    await logActivity(userId, "domain_created", `New domain added: ${d.name}`, { type: "domain", id });
  }

  // Payment history: a mix of past renewals spread across recent months so
  // the analytics page has something interesting to chart.
  const paymentSeed = [
    { domainIndex: 0, monthsAgo: 11, method: "UPI" },
    { domainIndex: 3, monthsAgo: 9, method: "Credit Card" },
    { domainIndex: 7, monthsAgo: 8, method: "UPI" },
    { domainIndex: 4, monthsAgo: 7, method: "Net Banking" },
    { domainIndex: 8, monthsAgo: 6, method: "Wallet" },
    { domainIndex: 0, monthsAgo: 5, method: "UPI" },
    { domainIndex: 6, monthsAgo: 4, method: "Debit Card" },
    { domainIndex: 3, monthsAgo: 2, method: "UPI" },
    { domainIndex: 8, monthsAgo: 1, method: "Credit Card" },
  ];

  for (const p of paymentSeed) {
    const domain = createdDomains[p.domainIndex];
    const paymentDate = subDays(today, p.monthsAgo * 30);
    const paymentId = newId("pay");
    await db.insert(payments).values({
      id: paymentId,
      userId,
      domainId: domain.id,
      domainNameSnapshot: domain.name,
      customerId: domain.owner?.id ?? null,
      customerNameSnapshot: domain.owner?.fullName ?? "",
      transactionId: generateTransactionId(paymentDate),
      amount: domain.renewalPrice,
      currency: "INR",
      method: p.method,
      status: "Success",
      renewalPeriodYears: 1,
      previousExpiryDate: fmt(subYears(paymentDate, 1)),
      newExpiryDate: fmt(paymentDate),
      date: paymentDate.toISOString(),
    });
    await logActivity(userId, "payment_recorded", `Renewed ${domain.name} for ₹${domain.renewalPrice}`, {
      type: "payment",
      id: paymentId,
    });
  }

  console.log("Seed complete.");
  console.log("Demo login -> email: demo@domiify.app  password: Demo@1234");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => {
    sqlite.close();
  });
