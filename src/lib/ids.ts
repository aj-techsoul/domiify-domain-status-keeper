import { v4 as uuidv4 } from "uuid";

export function newId(prefix?: string): string {
  const id = uuidv4();
  return prefix ? `${prefix}_${id}` : id;
}

/** Generates a Domiify-branded transaction id, e.g. DF-2026-7F3K9Q */
export function generateTransactionId(date: Date = new Date()): string {
  const year = date.getFullYear();
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `DF-${year}-${random}`;
}
