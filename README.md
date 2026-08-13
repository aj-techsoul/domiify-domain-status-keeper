# Domiify — Domain Management & Renewal System

Domiify is a full-stack web application that helps you track every domain you own, know exactly when each one expires, get automatically generated renewal reminders, and keep a complete record of every renewal payment. It was built as a functional internship/demo project — every button works, every calculation is derived from the database in real time, and nothing is hardcoded.

---

## 1. Technology stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 14** (App Router, TypeScript) | One codebase for UI + API routes, server-side auth, file-based routing |
| Database | **SQLite** via **better-sqlite3** | Zero external services to install — the whole app is self-contained and runs anywhere with `npm install && npm run dev` |
| ORM | **Drizzle ORM** | Type-safe schema and queries, lightweight, no code generation step required at runtime |
| Auth | **NextAuth.js (Auth.js) v4**, credentials provider + JWT sessions | Secure, well-documented, session data available on both server and client |
| Passwords | **bcryptjs** | Industry-standard salted password hashing |
| Validation | **Zod** | Shared validation schemas reused by both client-side forms and server-side API routes |
| Styling | **Tailwind CSS** | Fast to build a consistent, responsive design system; class-based dark mode |
| Charts | **Recharts** | Analytics bar chart + category pie chart |
| Theming | **next-themes** | Light/dark/system mode with no flash-of-wrong-theme |

No external payment gateway, email service, or cloud database is required — everything runs locally, which keeps the project easy to set up, grade, and demo.

---

## 2. Project structure

```
domiify/
├── src/
│   ├── app/
│   │   ├── (auth)/                  # Public auth pages (own layout, split-screen design)
│   │   │   ├── login/page.tsx
│   │   │   ├── register/page.tsx
│   │   │   └── forgot-password/page.tsx
│   │   ├── (dashboard)/             # Protected app pages (sidebar + topbar layout)
│   │   │   ├── layout.tsx
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── domains/page.tsx
│   │   │   ├── domains/[id]/page.tsx
│   │   │   ├── notifications/page.tsx
│   │   │   ├── calendar/page.tsx
│   │   │   ├── payments/page.tsx
│   │   │   ├── payments/[id]/page.tsx
│   │   │   ├── analytics/page.tsx
│   │   │   ├── profile/page.tsx
│   │   │   └── settings/page.tsx
│   │   ├── api/                     # REST API routes (all scoped to the logged-in user)
│   │   │   ├── auth/[...nextauth]/route.ts
│   │   │   ├── auth/register/route.ts
│   │   │   ├── domains/route.ts             (GET list, POST create)
│   │   │   ├── domains/[id]/route.ts        (GET, PUT, DELETE)
│   │   │   ├── domains/[id]/renew/route.ts  (POST — payment simulation + renewal)
│   │   │   ├── payments/route.ts
│   │   │   ├── payments/[id]/route.ts
│   │   │   ├── notifications/route.ts
│   │   │   ├── notifications/[id]/route.ts
│   │   │   ├── notifications/preferences/route.ts
│   │   │   ├── notifications/sync/route.ts
│   │   │   ├── search/route.ts
│   │   │   ├── analytics/route.ts
│   │   │   └── profile/route.ts
│   │   ├── layout.tsx, page.tsx, globals.css
│   ├── components/                  # Reusable UI (sidebar, topbar, modals, charts, ui/*)
│   ├── lib/
│   │   ├── schema.ts                # Drizzle table definitions (the database schema)
│   │   ├── db.ts                    # SQLite connection
│   │   ├── auth.ts                  # NextAuth config + session helpers
│   │   ├── domain-utils.ts          # Days-remaining / status / health calculations
│   │   ├── notifications.ts         # Reminder-generation engine
│   │   ├── validations.ts           # Zod schemas (shared client + server)
│   │   ├── currency.ts, ids.ts, utils.ts, api-helpers.ts
│   ├── middleware.ts                 # Route protection (redirects unauthenticated users)
│   └── types/next-auth.d.ts
├── scripts/seed.ts                   # Realistic demo data seeder
├── drizzle.config.ts
├── .env.example
└── package.json
```

---

## 3. Setup instructions (run locally)

**Prerequisites:** Node.js 18.18+ and npm.

```bash
# 1. Install dependencies
npm install

# 2. Configure environment variables
cp .env.example .env
# open .env and set NEXTAUTH_SECRET to a random string, e.g.:
#   openssl rand -base64 32

# 3. Create the database tables
npm run db:push

# 4. Apply the v2 schema migration (adds customers, activity_logs, and more)
npm run db:migrate-v2

# 5. Seed realistic demo data (a demo account + 9 domains + payment history)
npm run db:seed

# 6. Start the app
npm run dev
```

Open **http://localhost:3000** — you'll be redirected to the login page.

To build and run a production bundle instead:

```bash
npm run build
npm run start
```

> **Troubleshooting `npm install`:** `better-sqlite3` (the SQLite driver) ships prebuilt native binaries for common platforms, downloaded automatically during `npm install`. On most machines this just works. If your network blocks GitHub release downloads and `npm install` falls back to compiling from source, make sure you have Python 3 and a C++ build toolchain available (Linux: `build-essential`; macOS: `xcode-select --install`; Windows: install the "Desktop development with C++" workload via Visual Studio Build Tools), then re-run `npm install`.

Other useful scripts:

| Command | Purpose |
|---|---|
| `npm run db:push` | Sync `src/lib/schema.ts` to the SQLite database (creates/updates tables) |
| `npm run db:seed` | Insert demo data (safe to re-run — skips seeding if the demo account already exists; delete `domiify.db` to start over) |
| `npm run db:studio` | Opens Drizzle Studio, a GUI for browsing/editing the database |
| `npm run lint` | Run ESLint |

---

## 4. Environment variables

Defined in `.env` (see `.env.example`):

| Variable | Description |
|---|---|
| `DATABASE_URL` | Path to the local SQLite file, e.g. `file:./domiify.db` |
| `NEXTAUTH_SECRET` | Secret used to sign session JWTs — **must** be changed for any real deployment |
| `NEXTAUTH_URL` | Base URL of the app (`http://localhost:3000` in development) |
| `DEFAULT_CURRENCY` | Currency shown before a user sets their own preference (defaults to `INR`) |

---

## 5. Database schema

SQLite tables, defined with Drizzle ORM in `src/lib/schema.ts`:

**`users`** — id, name, email (unique), password_hash, currency, theme, created_at
**`domains`** — id, user_id (FK→users), name, registrar, purchase_date, expiry_date, renewal_price, category, notes, auto_renew, created_at, updated_at
**`payments`** — id, user_id (FK), domain_id (FK→domains), domain_name_snapshot, transaction_id (unique), amount, method, status, previous_expiry_date, new_expiry_date, date
**`notifications`** — id, user_id (FK), domain_id (FK, nullable), domain_name_snapshot, type, message, read, date
**`notification_preferences`** — user_id (PK/FK), notify_30, notify_15, notify_7, notify_3, notify_1, notify_expired

Design notes:
- All foreign keys cascade on delete, so removing a domain also removes its notifications; **payment records are preserved independently** (via `domain_name_snapshot`) so financial history survives even if a domain is later deleted.
- **Nothing derived is stored.** Days-remaining, domain status, and health level are never written to the database — they're computed on every request from `expiry_date` vs. the current server time (see `src/lib/domain-utils.ts`). This guarantees the dashboard is always accurate, even if the app hasn't been opened in weeks.
- Every table that holds user data includes `user_id`, and every API route filters by the logged-in user's id (see `src/lib/api-helpers.ts` → `requireUser()`), so one account can never read or modify another account's data. This was verified by testing cross-account access during development (a second account gets a 404, not another user's data).

---

## 6. Demo login credentials

```
Email:    demo@domiify.app
Password: Demo@1234
```

The demo account is pre-loaded with 9 realistic domains (a mix of safe, expiring-soon, and one expired, across every category) and 9 historical renewal payments spread across the last year, so the dashboard, notifications, calendar, and analytics pages all have real content the moment you log in. You can also register your own account from the login page — new accounts start empty.

---

## 7. Feature walkthrough

**Dashboard** — Six stat cards (total, active, expiring soon, expired, total spend, upcoming renewal cost) computed live from the database, plus an "Expiring Soon" section with one-click **Renew Now** buttons.

**Domains** — Full CRUD with a table/grid toggle, live search, category/status filters, and sorting by expiry date or price. Each domain has a detail page showing its full record and its own payment history.

**Notifications** — A notification center listing every reminder generated for the account, with read/unread state, type/date filters, and a "mark all as read" action. A bell icon in the top bar shows a live unread badge and a quick-preview dropdown.

**Calendar** — A month grid showing every domain's expiry date; clicking a domain opens its details.

**Payments** — Every renewal produces a permanent payment record with a generated transaction ID. The Payments page supports search (by domain or transaction ID) and filtering by method/status, plus a detail view per transaction.

**Analytics** — Total domains, total spend, average renewal cost, upcoming cost, a 12-month spending bar chart, a category breakdown pie chart, and a most-expensive-domains ranking.

**Profile & Settings** — Update your name and preferred currency, toggle light/dark/system theme, and enable/disable each individual reminder interval.

**Search** — A global search box in the top bar queries domains by name and shows expiry/status/price inline.

---

## 8. How the expiry notification system works

Nothing about a domain's urgency is stored — it's all computed from `expiry_date` on every read (`src/lib/domain-utils.ts`):

```
daysRemaining = expiryDate − today   (calendar days, via date-fns)
```

That number is mapped to a status:

| Days remaining | Status | Reminder generated |
|---|---|---|
| > 30 | Safe | — |
| ≤ 30 | Upcoming | ✅ |
| ≤ 15 | Reminder | ✅ |
| ≤ 7 | Warning | ✅ |
| ≤ 3 | Urgent | ✅ |
| ≤ 1 | Critical | ✅ |
| ≤ 0 | Expired | ✅ |

There's no background cron job. Instead, `syncNotificationsForUser()` (`src/lib/notifications.ts`) runs on every dashboard/notifications API call: for each domain, it checks which thresholds have already been crossed and inserts any notification record that doesn't exist yet — using a `domainId:type` key so the same reminder is never created twice. Users can disable specific intervals in **Settings → Reminder Preferences**, which the sync function respects. When a domain is renewed, its old warning notifications are cleared (they no longer apply to the new expiry date) and replaced with a single "Renewed" confirmation.

A separate, coarser 5-level **Domain Health** indicator (🟢🟡🟠🔴⚫) is shown on domain cards for at-a-glance scanning, computed the same way from `daysRemaining`.

---

## 9. How the payment simulation works

This is explicitly a **demo payment system** — Domiify does not integrate a real payment gateway, and no real money ever moves. The renewal flow (`POST /api/domains/:id/renew`) is designed to feel like a real checkout without claiming to be one:

1. **Review** — shows the domain, current expiry, new expiry (current expiry + 1 year, not "+1 year from today," so early renewals never lose paid-for time), and price.
2. **Method** — the user picks UPI, Credit Card, Debit Card, Net Banking, or Wallet.
3. **Confirm** — a final summary before submitting.
4. **Processing** — the server generates a transaction ID (`DF-<year>-<random>`), and ~96% of the time returns success; ~4% of the time it simulates a gateway decline, on purpose, so the failure-handling path (spec section 20) is real and demonstrable rather than theoretical. No charge is implied either way.
5. **Success/Failure screen** — on success, shows domain, amount, method, transaction ID, new expiry date, and date. A permanent `payments` row is written either way (status `Success` or `Failed`), so failed attempts are auditable too.
6. On success, the domain's `expiry_date` is updated and a "Renewed" notification is created — all in one server-side transaction-like sequence.

---

## 10. Error handling covered

- Invalid domain name format, missing/invalid dates, expiry date before purchase date, non-positive renewal price → rejected by a shared Zod schema (`src/lib/validations.ts`) used by both the form and the API route, with inline field-level messages.
- Duplicate domain names (per account) → `409` with a clear message, both on create and on edit.
- Simulated failed payments → dedicated failure screen with a retry option; no domain/expiry mutation happens on failure.
- Unauthorized access → `middleware.ts` redirects unauthenticated users to `/login` for every protected page and API route; every API route additionally re-verifies the resource belongs to the logged-in user (returns `404`, not `403`, to avoid confirming a resource's existence to the wrong account).
- Invalid login → generic "Invalid email or password" (never reveals which field was wrong).
- Empty states → dashboard, domains, payments, and notifications all show a friendly empty state instead of a blank page when there's no data yet.
- Network/server errors → API routes catch unexpected errors and return a generic `500` with a safe message (details are logged server-side only); the client shows a toast rather than crashing.

---

## 11. Demo Mode

Domiify is clearly labelled as a demo throughout the UI (sidebar note, renewal confirmation text) since it's an internship project. To demonstrate the full flow in a live walkthrough:

1. Log in with the demo credentials above.
2. From the Dashboard, click **Add Domain** and create one with an expiry date a few days out.
3. Watch its countdown and status badge on the Dashboard/Domains page.
4. Open **Notifications** — a reminder for the new domain will already be generated.
5. Click **Renew Now** on that domain.
6. Step through payment method selection → confirmation → the simulated success screen (transaction ID, new expiry date).
7. See the new payment appear instantly on the **Payments** page.
8. Return to the domain — its expiry date has moved forward exactly one year, and its status badge has gone green.
9. Open **Analytics** — the new payment is reflected in total spend and the monthly chart.
10. Open **Calendar** — the domain's new expiry date is shown on the correct day.

---

## 12. Future improvements

- Real payment gateway integration (Razorpay/Stripe) behind the same UI, swapping only the server-side confirmation step.
- Transactional email reminders (the current "Forgot password" and reminder system are in-app only / UI-only for password reset).
- WHOIS/registrar API integration to auto-detect a domain's real expiry date instead of manual entry.
- Auto-renew execution (the `autoRenew` flag exists in the schema but isn't yet acted on by a scheduler).
- Multi-currency conversion (currently currency is a display preference, not a live-converted rate).
- Team/organization accounts with shared domain ownership and role-based permissions.
- CSV/PDF export for payment history and analytics.
- Two-factor authentication.

---

Built as a demo/internship project. All payments are simulated — no real financial transactions occur.
