/**
 * Safe, idempotent Domiify 2.0 schema migration.
 *
 * This adds everything the 2.0 upgrade needs (the `customers` table, the
 * `activity_logs` table, new columns on `domains`/`payments`/`notifications`,
 * and their indexes) on top of an EXISTING v1 database, without ever
 * dropping or rewriting a table. Every statement is guarded by an
 * existence check first (via `PRAGMA table_info` / `sqlite_master`), so
 * running this more than once is a no-op the second time.
 *
 * Deliberately raw SQL instead of `drizzle-kit push`: this project hit a
 * real bug where `drizzle-kit push --force` misdiagnosed an already-current
 * index as missing, aborted partway through its generated migration, and
 * left one table's data wiped even though the command reported an error
 * (see the "Known issues" note in the final report). Hand-written,
 * individually-guarded statements don't have that failure mode - each one
 * either applies cleanly or is skipped because it's already there.
 *
 * Run with: npm run db:migrate-v2
 */
import "dotenv/config";
import { sqlite } from "../src/lib/db";
import fs from "node:fs";
import path from "node:path";

function tableExists(name: string): boolean {
  const row = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name);
  return !!row;
}

function columnExists(table: string, column: string): boolean {
  const cols = sqlite.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return cols.some((c) => c.name === column);
}

function indexExists(name: string): boolean {
  const row = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name=?").get(name);
  return !!row;
}

function run(label: string, sql: string) {
  sqlite.exec(sql);
  console.log(`  applied: ${label}`);
}

async function main() {
  const dbPath = process.env.DATABASE_URL?.replace(/^file:/, "") || "./domiify.db";
  if (fs.existsSync(dbPath)) {
    // Flush the WAL into the main file BEFORE copying it, or a plain file
    // copy silently misses whatever hasn't been checkpointed yet (this is
    // exactly how a backup taken mid-session turned out to be missing
    // recent writes during development - see the final report).
    sqlite.pragma("wal_checkpoint(FULL)");
    const backupPath = path.join(path.dirname(dbPath), `${path.basename(dbPath, ".db")}.pre-v2-backup.db`);
    fs.copyFileSync(dbPath, backupPath);
    console.log(`Backed up ${dbPath} -> ${backupPath}`);
  }

  console.log("Applying Domiify 2.0 migration (idempotent - safe to re-run)...");

  // --- customers table ---
  if (!tableExists("customers")) {
    run(
      "create customers table",
      `CREATE TABLE customers (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        full_name TEXT NOT NULL,
        username TEXT NOT NULL DEFAULT '',
        email TEXT NOT NULL DEFAULT '',
        phone TEXT NOT NULL DEFAULT '',
        company TEXT NOT NULL DEFAULT '',
        website TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
        updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
      );`,
    );
  } else {
    console.log("  skip: customers table already exists");
  }
  if (!indexExists("customers_user_email_idx")) run("customers_user_email_idx", "CREATE INDEX customers_user_email_idx ON customers(user_id, email);");
  if (!indexExists("customers_user_username_idx")) run("customers_user_username_idx", "CREATE INDEX customers_user_username_idx ON customers(user_id, username);");
  if (!indexExists("customers_user_name_idx")) run("customers_user_name_idx", "CREATE INDEX customers_user_name_idx ON customers(user_id, full_name);");
  if (!indexExists("customers_user_company_idx")) run("customers_user_company_idx", "CREATE INDEX customers_user_company_idx ON customers(user_id, company);");

  // --- domains: customer_id ---
  if (!columnExists("domains", "customer_id")) {
    run("domains.customer_id", "ALTER TABLE domains ADD COLUMN customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL;");
  } else {
    console.log("  skip: domains.customer_id already exists");
  }
  if (!indexExists("domains_customer_idx")) run("domains_customer_idx", "CREATE INDEX domains_customer_idx ON domains(customer_id);");
  if (!indexExists("domains_user_expiry_idx")) run("domains_user_expiry_idx", "CREATE INDEX domains_user_expiry_idx ON domains(user_id, expiry_date);");
  if (!indexExists("domains_user_name_idx")) run("domains_user_name_idx", "CREATE INDEX domains_user_name_idx ON domains(user_id, name);");

  // --- payments: customer_id, customer_name_snapshot, currency, renewal_period_years ---
  if (!columnExists("payments", "customer_id")) {
    run("payments.customer_id", "ALTER TABLE payments ADD COLUMN customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL;");
  } else {
    console.log("  skip: payments.customer_id already exists");
  }
  if (!columnExists("payments", "customer_name_snapshot")) {
    run("payments.customer_name_snapshot", "ALTER TABLE payments ADD COLUMN customer_name_snapshot TEXT NOT NULL DEFAULT '';");
  } else {
    console.log("  skip: payments.customer_name_snapshot already exists");
  }
  if (!columnExists("payments", "currency")) {
    run("payments.currency", "ALTER TABLE payments ADD COLUMN currency TEXT NOT NULL DEFAULT 'INR';");
  } else {
    console.log("  skip: payments.currency already exists");
  }
  if (!columnExists("payments", "renewal_period_years")) {
    run("payments.renewal_period_years", "ALTER TABLE payments ADD COLUMN renewal_period_years INTEGER NOT NULL DEFAULT 1;");
  } else {
    console.log("  skip: payments.renewal_period_years already exists");
  }
  if (!indexExists("payments_domain_idx")) run("payments_domain_idx", "CREATE INDEX payments_domain_idx ON payments(domain_id);");
  if (!indexExists("payments_customer_idx")) run("payments_customer_idx", "CREATE INDEX payments_customer_idx ON payments(customer_id);");
  if (!indexExists("payments_user_date_idx")) run("payments_user_date_idx", "CREATE INDEX payments_user_date_idx ON payments(user_id, date);");

  // --- notifications: dismissed ---
  if (!columnExists("notifications", "dismissed")) {
    run("notifications.dismissed", "ALTER TABLE notifications ADD COLUMN dismissed INTEGER NOT NULL DEFAULT 0;");
  } else {
    console.log("  skip: notifications.dismissed already exists");
  }
  if (!indexExists("notifications_user_read_idx")) run("notifications_user_read_idx", "CREATE INDEX notifications_user_read_idx ON notifications(user_id, read);");
  if (!indexExists("notifications_user_date_idx")) run("notifications_user_date_idx", "CREATE INDEX notifications_user_date_idx ON notifications(user_id, date);");
  if (!indexExists("notifications_user_dismissed_idx")) run("notifications_user_dismissed_idx", "CREATE INDEX notifications_user_dismissed_idx ON notifications(user_id, dismissed);");

  // --- activity_logs table ---
  if (!tableExists("activity_logs")) {
    run(
      "create activity_logs table",
      `CREATE TABLE activity_logs (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        message TEXT NOT NULL,
        entity_type TEXT NOT NULL DEFAULT '',
        entity_id TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
      );`,
    );
  } else {
    console.log("  skip: activity_logs table already exists");
  }
  if (!indexExists("activity_user_date_idx")) run("activity_user_date_idx", "CREATE INDEX activity_user_date_idx ON activity_logs(user_id, created_at);");

  console.log("\nMigration complete. No existing rows were modified or removed.");
}

main()
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  })
  .finally(() => {
    sqlite.close();
  });
