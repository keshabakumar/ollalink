# @v1/backend

The Convex backend for Ollalink — authentication, database, storage, background
jobs, validated server actions, http actions, JWKS/OIDC, rate limiting, and
billing. This is the heart of the platform.

## Layout

```
convex/
├── schema.ts            # All tables (users, workspaces, jobs, devices, files, audit, events…)
├── auth.ts              # Convex Auth providers (email+password, OTP, Google)
├── auth.config.ts       # Auth config
├── http.ts              # HTTP actions: JWKS, OIDC, webhooks
├── crons.ts             # Scheduled jobs
├── orgs.ts              # Multi-tenant workspaces + RBAC + invites
├── users.ts             # User profile, username, image, account deletion
├── sessions.ts          # Active sessions, sign-out-others
├── jobs.ts              # Background jobs (create, listPaged, status)
├── devices.ts           # Remote devices, pairing codes
├── files.ts             # File storage (upload, listPaged, remove)
├── audit.ts / auditLog.ts # Audit trail
├── notifications.ts     # Notifications (unreadCount, list)
├── apiKeys.ts           # API keys
├── counters.ts          # Rate-limit / usage counters
├── usage.ts / subscriptions.ts # Billing (Polar)
├── dashboard.ts         # Aggregate stats for home overview
├── backend.ts           # PROXY action → external backend
├── email.ts / ResendOTP.ts # Auth email (SMTP via nodemailer) + OTP
├── email/               # sendEmail() + React Email templates
├── passwordProviders.ts # Password policy + brute-force lockout
├── devGuard.ts          # DEV_SEED gating for internal functions
├── utils/validators.ts  # Shared Zod validators
├── env.ts               # t3-env validated env vars
├── security.test.ts     # In-process IDOR/RBAC suite (runs every PR)
├── init.ts / seed.ts    # Bootstrap + DEV_SEED-gated seeders/profilers
└── _generated/         # Convex generated API + dataModel (DO NOT EDIT)
```

## Commands

```bash
bun dev      # convex dev --tail-logs
bun setup    # convex dev --once && convex env set VALIDATE_ENV=true
bun seed     # convex dev --once && convex run init
bun test     # vitest (security.test.ts, edge-runtime + convex-test)
```

## Environment

See [`convex/env.ts`](./convex/env.ts) and the root [`ENV.md`](../../ENV.md).
Validation is gated on `VALIDATE_ENV=true`. Set vars on the Convex dashboard or
via `convex env set <NAME> <VALUE>`.

## Multi-tenancy

Every resource table carries a `workspaceId` (see `schema.ts`). It is
`optional` only so deploys don't fail validation against pre-migration rows;
the function layer always sets it. RBAC + invites live in `orgs.ts`.

## Auth → external backend

The dashboard talks to an external backend two ways (see
`frontend/dashboard/src/lib/backend-client.ts`):

- **DIRECT** — browser → backend carrying the Convex JWT; backend verifies via
  JWKS at `<CONVEX_SITE_URL>/.well-known/jwks.json` (audience `convex`).
- **PROXY** — browser → Convex action (`backend.ts`) → backend with a service
  key + userId.

## Tests

`security.test.ts` is the fast, in-process IDOR/RBAC suite that runs on every
PR. The live adversarial equivalents live in `e2e/p2-idor.js` (run against a
deployed stack, not blocking CI).

## Generated code

Never edit `convex/_generated/` — it is produced by `convex dev`.