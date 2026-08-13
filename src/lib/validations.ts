import { z } from "zod";
import { DOMAIN_CATEGORIES, PAYMENT_METHODS } from "./domain-utils";

// A pragmatic domain-name check: labels separated by dots, valid characters,
// a TLD of at least 2 letters. Good enough to catch obvious typos without
// being a full RFC 1035 validator.
const DOMAIN_NAME_REGEX =
  /^(?!-)[a-zA-Z0-9-]{1,63}(?<!-)(\.(?!-)[a-zA-Z0-9-]{1,63}(?<!-))*\.[a-zA-Z]{2,63}$/;

export const customerSchema = z.object({
  fullName: z.string().trim().min(2, "Full name must be at least 2 characters").max(100),
  username: z.string().trim().max(60).optional().default(""),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(255)
    .optional()
    .default("")
    .refine((v) => v === "" || z.string().email().safeParse(v).success, "Enter a valid email address"),
  phone: z.string().trim().max(30).optional().default(""),
  company: z.string().trim().max(150).optional().default(""),
  website: z.string().trim().max(255).optional().default(""),
  notes: z.string().trim().max(2000).optional().default(""),
});

export type CustomerFormInput = z.infer<typeof customerSchema>;

const domainBaseSchema = z.object({
  name: z
    .string()
    .trim()
    .toLowerCase()
    .min(4, "Domain name is too short")
    .max(253, "Domain name is too long")
    .regex(DOMAIN_NAME_REGEX, "Enter a valid domain name, e.g. example.com"),
  registrar: z.string().trim().min(2, "Registrar is required").max(100),
  purchaseDate: z.string().refine((v) => !isNaN(Date.parse(v)), "Enter a valid purchase date"),
  expiryDate: z.string().refine((v) => !isNaN(Date.parse(v)), "Enter a valid expiry date"),
  renewalPrice: z.coerce
    .number({ invalid_type_error: "Renewal price must be a number" })
    .positive("Renewal price must be greater than 0")
    .max(10_000_000, "That price looks unrealistic"),
  category: z.enum(DOMAIN_CATEGORIES).default("Other"),
  notes: z.string().max(2000).optional().default(""),
  autoRenew: z.boolean().optional().default(false),
  // Customer association (Domiify 2.0, Feature 1/4): either point at an
  // existing customer, or supply inline fields to find-or-create one.
  // Both are optional so existing "ownerless" domains keep working.
  customerId: z
    .string()
    .optional()
    .transform((v) => (v ? v : undefined)),
  customer: customerSchema.partial({ fullName: true }).optional(),
  forceNewCustomer: z.boolean().optional().default(false),
  // Explicit "unassign the current owner" signal (Feature 9) - distinct
  // from simply omitting customerId, which means "leave the existing
  // association alone" on edit.
  clearCustomer: z.boolean().optional().default(false),
});

export const domainSchema = domainBaseSchema.refine(
  (data) => new Date(data.expiryDate) > new Date(data.purchaseDate),
  {
    message: "Expiry date must be after the purchase date",
    path: ["expiryDate"],
  },
);

export type DomainInput = z.infer<typeof domainSchema>;

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain an uppercase letter")
    .regex(/[0-9]/, "Password must contain a number"),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const renewSchema = z.object({
  method: z.enum(PAYMENT_METHODS),
});

export const notificationPreferencesSchema = z.object({
  notify30: z.boolean(),
  notify15: z.boolean(),
  notify7: z.boolean(),
  notify3: z.boolean(),
  notify1: z.boolean(),
  notifyExpired: z.boolean(),
});

export const profileSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  currency: z.enum(["INR", "USD", "EUR", "GBP"]),
});

export const bulkDomainActionSchema = z.object({
  action: z.enum(["renew", "delete", "assignCustomer"]),
  domainIds: z.array(z.string()).min(1, "Select at least one domain").max(500),
  customerId: z.string().optional(),
  method: z.enum(PAYMENT_METHODS).optional(),
});

/** Formats the first Zod issue into a single user-friendly string. */
export function firstZodError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input";
}
