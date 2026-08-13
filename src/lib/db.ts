import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";

// Reuse a single connection across hot-reloads in dev to avoid
// "database is locked" errors from opening many file handles.
declare global {
  // eslint-disable-next-line no-var
  var __domiifySqlite: Database.Database | undefined;
}

const dbPath = (process.env.DATABASE_URL || "file:./domiify.db").replace("file:", "");
const resolvedPath = path.isAbsolute(dbPath) ? dbPath : path.join(process.cwd(), dbPath);

const sqlite = global.__domiifySqlite ?? new Database(resolvedPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

if (process.env.NODE_ENV !== "production") {
  global.__domiifySqlite = sqlite;
}

export const db = drizzle(sqlite, { schema });
export { sqlite };
