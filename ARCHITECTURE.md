# Ollalink — Architecture & Codebase Map

> Single source of truth for how the Ollalink monorepo is structured, what each
> workspace package does, how data flows, and where to make changes.
> Keep this file in sync with the actual tree. Last updated: 2026-08-07.

## 1. Overview

Ollalink is a **multi-tenant operations platform** for remote device management,
background jobs, audit trails, and billing. It is a Bun-managed Turborepo
monorepo built on **Next.js** (apps) + **Convex** (backend) + a standalone
**WebSocket relay** and an **Electron Windows agent**.

```
                        ┌─────────────────────────────────────────────┐
                        │                  Browser                     │
                        │ frontend/dashboard (dashboard)              │
                        └───────────────┬───────────────┬─────────────┘
                                        │               │
                          Convex JWT (DIRECT)    Convex actions (PROXY)
                                        │               │
                                        ▼               ▼
                              ┌──────────────────────────────────┐
                              │   backend/convex (Convex)          │
                              │   auth · db · jobs · files · audit │
                              │   http actions · JWKS / OIDC       │
                              └───────────┬───────────────┬────────┘
                                          │ JWKS verify    │ service-key
                                          ▼                ▼
                              ┌────────────────┐  ┌──────────────────┐
                              │ backend/         │  │ backend/relay(WS)│
                              │ reference-api    │  │ WebRTC signaling │
                              │ (ext, :4000)    │  │ + video fallback │
                              └────────────────┘  └────────┬─────────┘
                                                          │
                                                          ▼
                                                ┌──────────────────┐
                                                │ windows-agent    │
                                                │ (Electron, Rust) │
                                                └──────────────────┘
```

### Tech stack

| Layer        | Technology                                                    |
| ------------ | ------------------------------------------------------------ |
| Monorepo     | Bun workspaces + Turborepo 2.1                                |
| Apps         | Next.js 14 (App Router), React 18                            |
| Backend      | Convex (auth, db, storage, jobs, actions, http, crons)       |
| External API | `backend/reference-api` (reference Node server, port 4000) |
| Realtime     | `backend/relay` — `ws` WebSocket relay for WebRTC signaling |
| Desktop      | `windows-agent` — Electron + Vite + React 19, Rust native   |
| UI           | TailwindCSS + shadcn/Radix (`shared/ui`)                     |
| Email         | React Email (`shared/email`) + Resend / SMTP (nodemailer)    |
| Analytics    | OpenPanel (`shared/analytics`)                              |
| Logging      | pino (`shared/logger`)                                       |
| Lint/format  | Biome 1.8 (root) + oxlint (windows-agent)                     |
| Types        | TypeScript 5.5 (shared base in `shared/tooling-typescript`)  |
| Tests        | Vitest (backend, edge-runtime) + Playwright (e2e)           |

## 2. Repository layout

The repo is split into three top-level domains so anyone can find the frontend,
backend, and shared code at a glance:

```
ollalink/
├── frontend/                  # 🖥️  Frontend apps (workspace: frontend/*)
│   └── dashboard/             # @v1/app  — Next.js dashboard (port 3000)
├── backend/                    # ⚙️  Backend services (workspace: backend/*)
│   ├── convex/                 # @v1/backend — Convex functions + schema (the API)
│   ├── relay/                  # @v1/relay — WebSocket relay for WebRTC (port 8080)
│   └── reference-api/         # Reference external backend (Node, :4000)
├── shared/                     # 📦  Shared libraries (workspace: shared/*)
│   ├── ui/                     # @v1/ui — shadcn/Radix component library
│   ├── email/                  # @v1/email — React Email templates
│   ├── analytics/             # @v1/analytics — OpenPanel client/server
│   ├── logger/                # @v1/logger — pino logger
│   └── tooling-typescript/    # @v1/typescript — shared tsconfig bases
├── windows-agent/              # Electron desktop agent (NOT a workspace pkg)
├── deploy/                      # Numbered bash deployment runbook (01–53)
│   └── helpers/                # Standalone one-off / diagnostic scripts
├── e2e/                        # @v1/e2e — Playwright + adversarial suites
├── scripts/                    # Root-level one-off dev/utility scripts
├── self-hosted/                # docker-compose for GlitchTip + Mailpit
├── archive/                    # Reference-only snapshots (NOT in workspace)
│   ├── agent-win-archive/      # Original Rust Windows agent (non-functional)
│   └── convex-ready-template-main/ # Archived upstream template
├── package.json                # Root workspace + scripts
├── turbo.json                  # Turborepo task graph
├── tsconfig.json               # Extends @v1/typescript/base.json
├── biome.json                  # Root Biome config (lint/format)
├── project.config.ts           # Central project config (host, ports, backend)
├── vercel.json / render.yaml    # Hosting configs
├── ARCHITECTURE.md / ENV.md     # Codebase map + env var reference
└── README.md / ROADMAP.md / session.md
```

> **Where is…?**
> - **Frontend** → `frontend/dashboard` (the app)
> - **Backend (API)** → `backend/convex` (Convex functions, schema, auth, JWKS)
> - **Backend (realtime)** → `backend/relay` (WebSocket relay)
> - **Backend (reference)** → `backend/reference-api` (the swappable echo backend)
> - **Shared UI/components** → `shared/ui`
> - **Shared config** → `shared/tooling-typescript`

## 3. Apps

### `frontend/dashboard` — `@v1/app` (dashboard)

The main product UI. Next.js 14 App Router, locale-segmented routes.

```
frontend/dashboard/
├── src/
│   ├── app/
│   │   ├── [locale]/
│   │   │   ├── (dashboard)/         # Authenticated area
│   │   │   │   ├── layout.tsx        # Sidebar + Topbar + WorkspaceProvider
│   │   │   │   ├── page.tsx          # Home overview (stat cards + activity)
│   │   │   │   ├── _components/      # sidebar, topbar, command-palette, etc.
│   │   │   │   ├── analytics/        # Audit log viewer
│   │   │   │   ├── devices/          # Device list + [deviceId] live viewer
│   │   │   │   ├── files/           # File storage (paginated)
│   │   │   │   ├── jobs/            # Background jobs (paginated)
│   │   │   │   ├── platform/        # Platform/admin page
│   │   │   │   └── settings/        # Profile + billing + account security
│   │   │   ├── (public)/login/      # Sign-in page
│   │   │   ├── onboarding/          # First-run username setup
│   │   │   ├── layout.tsx          # Root locale layout (providers, fonts)
│   │   │   ├── error.tsx / not-found.tsx
│   │   │   └── [...rest]/          # Catch-all 404
│   │   ├── convex-client-provider.tsx
│   │   └── global-error.tsx
│   ├── components/                 # Cross-page components (auth-form, sessions-card…)
│   ├── lib/
│   │   ├── backend-client.ts       # useDirectBackend / useProxyBackend hooks
│   │   ├── backend.config.ts       # DIRECT vs PROXY route table
│   │   ├── workspace-provider.tsx  # React context for current workspace
│   │   └── useWorkspace.ts        # Re-export of context hook
│   ├── locales/                    # i18n (en, es, fr) via next-international
│   ├── env.mjs                     # t3-env validated env vars
│   ├── instrumentation.ts          # Sentry server-side import
│   ├── middleware.ts              # Locale + auth middleware
│   └── types.tsx
├── sentry.{client,edge,server}.config.ts
├── next.config.mjs / tailwind.config.ts / postcss.config.mjs
├── tsconfig.json                  # extends @v1/typescript/nextjs.json
└── .env.example
```

**Backend access pattern** — the dashboard talks to the external backend two ways
(see `src/lib/backend-client.ts`):
- **DIRECT**: browser → backend with the Convex JWT; backend verifies via JWKS.
- **PROXY**: browser → Convex action → backend with a service key + userId.

### `frontend/marketing` — REMOVED

The marketing site (`@v1/web`) has been removed. The dashboard (`frontend/dashboard`)
is the only frontend app now.

### `backend/relay` — `@v1/relay`

Standalone TypeScript WebSocket server (no Next.js). Built with `tsc` to `dist/`,
shipped via `Dockerfile`.

- `src/index.ts` — session pairing (agent ↔ viewer), heartbeat/stale cleanup,
  binary pass-through for MSE video chunks, `/stats` endpoint, CORS health.
- Env: `PORT` (8080), `HEARTBEAT_INTERVAL_MS` (15000), `STALE_SESSION_TIMEOUT_MS` (60000).

### `archive/agent-win-archive` — `@v1/agent-win` (archived)

Archived Rust Windows agent (`Cargo.toml` + `src/`). Non-functional placeholder
that was never compiled. The **active** Windows agent now lives in
`/windows-agent` (Electron). Kept for reference for Phase 3 (DXGI capture +
H.264). Moved out of `apps/` so it's no longer a workspace member — nothing in
the active codebase imports `@v1/agent-win`.

## 4. Shared packages

### `backend/convex` — `@v1/backend` (Convex)

The heart of the platform. All Convex functions, schema, auth, http actions,
and the JWKS/OIDC endpoint live in `convex/`.

```
backend/convex/convex/
├── schema.ts                # All tables (users, workspaces, jobs, devices, files, audit, events…)
├── auth.ts / auth.config.ts  # Convex Auth (email+password, OTP, Google, sessions)
├── http.ts                  # HTTP actions: JWKS, OIDC, webhooks
├── crons.ts                 # Scheduled jobs
├── init.ts / seed.ts        # Bootstrap + DEV_SEED-gated seeders/profilers
├── orgs.ts                  # Multi-tenant workspaces + RBAC + invites
├── users.ts                 # User profile, username, image, account deletion
├── sessions.ts              # Active sessions, sign-out-others
├── jobs.ts                  # Background jobs (create, listPaged, status)
├── devices.ts               # Remote devices, pairing codes
├── files.ts                 # File storage (upload, listPaged, remove)
├── audit.ts / auditLog.ts   # Audit trail (recent, paginated)
├── notifications.ts         # Notifications (unreadCount, list)
├── apiKeys.ts               # API keys
├── counters.ts              # Rate-limit / usage counters
├── usage.ts / subscriptions.ts # Billing (Polar)
├── dashboard.ts             # Aggregate stats for home overview
├── backend.ts               # PROXY action → external backend
├── web.ts                   # Web actions
├── email.ts / ResendOTP.ts  # Auth email (SMTP via nodemailer) + OTP
├── email/
│   ├── index.ts             # sendEmail() via Resend
│   └── templates/           # React Email templates (subscriptionEmail.tsx)
├── passwordProviders.ts     # Password policy + brute-force lockout
├── devGuard.ts              # DEV_SEED gating for internal functions
├── utils/validators.ts      # Shared Zod validators
├── env.ts                   # t3-env validated Convex env vars
├── security.test.ts         # In-process IDOR/RBAC suite (runs on every PR)
├── tsconfig.json            # Convex-specific (excludes _generated/)
└── _generated/             # Convex generated API + dataModel (do not edit)
```

Tests: `vitest` with `edge-runtime` + `convex-test`. See `vitest.config.ts`.

### `shared/ui` — `@v1/ui`

shadcn/Radix component library. Each component is exported as a subpath
(see `exports` in `package.json`): `@v1/ui/button`, `@v1/ui/dialog`, etc.

```
shared/ui/src/
├── components/   # avatar, button, dialog, dropdown-menu, icons, input,
│                 # logo, scroll-area, select, skeleton, switch, tooltip, upload-input
├── utils/       # cn() + useDoubleCheck hook
└── globals.css  # Tailwind base (imported by apps)
```

### `shared/email` — `@v1/email`

React Email templates. `emails/welcome.tsx` is the only template currently;
`components/` holds shared email building blocks. Dev preview: `email dev -p 3003`.

### `shared/analytics` — `@v1/analytics`

OpenPanel integration. Three entry points:
- `./server` — `setupAnalytics()` (server-side identify, uses `OPENPANEL_SECRET_KEY`)
- `./client` — `<Provider/>` + `track()` (client, uses `NEXT_PUBLIC_OPENPANEL_CLIENT_ID`)
- `./events` — event name constants

### `shared/logger` — `@v1/logger`

Thin wrapper around `pino`. `export const logger = pino();` — import via
`@v1/logger` (main field points to `src/index.ts`).

## 5. Tooling

### `shared/tooling-typescript` — `@v1/typescript`

Shared tsconfig bases, extended by every TS package:
- `base.json` — strict, ES2022, NodeNext, `noUncheckedIndexedAccess`.
- `nextjs.json` — extends base; ESNext/Bundler, jsx preserve, Next plugin.
- `react-library.json` — extends base; `jsx: react-jsx`.

## 6. Standalone areas (not workspace packages)

### `windows-agent/`

Electron desktop app (the **active** Windows agent). Separate npm project
(`package-lock.json`, not Bun), uses **oxlint** instead of Biome, React 19,
Vite 8, electron-builder. Builds a portable `OllalinkAgent.exe`.

```
windows-agent/
├── electron/        # Electron main process (main.cjs)
├── src/             # React renderer (App.tsx, main.tsx)
├── native/          # Rust native modules
├── public/ / index.html
├── vite.config.ts / tsconfig.{app,node}.json
└── .oxlintrc.json
```

### `backend/reference-api/`

Reference external backend (`server.mjs`, port 4000). Verifies Convex JWTs
via JWKS. Used by the dashboard's DIRECT/PROXY paths and by the e2e suites.
Treat as reference-only for real deployments (see ROADMAP BUG-6).

### `deploy/`

Numbered bash scripts (01–53) that bootstrap a clean Linux VM into a full
self-hosted stack: host setup → clone → Convex up → backend deploy → app
build → systemd → auth → multi-tenant → jobs → HTTPS (Caddy/Cloudflare) →
observability (GlitchTip/Mailpit) → email → counters. Plus runbook helpers
(`setup.sh`, `backup.sh`, `db-check.sh`, `generateKeys.mjs`). Standalone
one-off / diagnostic scripts live in `deploy/helpers/`.

### `e2e/` — `@v1/e2e`

Playwright suites run against a **live deployed stack** (not blocking CI):
- `p2-idor.js` — 23 IDOR/RBAC probes as two real tenants.
- `p2-auth.js` — full auth journey (signup → verify → onboarding → reset).
- `p-*.js` — dashboard UI suites (sidebar, feedback, home, notif, cmdk, paging, sessions).

The fast in-process equivalents live in `backend/convex/convex/security.test.ts`
and **do** run on every PR.

### `self-hosted/`

`docker-compose.yml` (+ override) for self-hosted **GlitchTip** (Sentry-compatible)
and **Mailpit** (SMTP sink). The app's existing `@sentry/nextjs` wiring reports
to GlitchTip by setting `NEXT_PUBLIC_SENTRY_DSN`.

### `scripts/`

Root-level one-off dev/utility scripts: `generateKeys.mjs`, `set-jwks.*`,
`test-otp-action.mjs`, `test-*.json`, `setup-config.json`, `TEMPLATE.md`.
See `scripts/README.md`. None are part of the build or deploy runbook.

### `archive/`

Reference-only snapshots, not in the workspace:
- `agent-win-archive/` — original Rust Windows agent (non-functional).
- `convex-ready-template-main/` — archived upstream template (read by
  `scripts/set-jwks.*` for the generated JWKS).

## 7. Data flow

### Authentication
1. Browser hits `frontend/dashboard` → Convex Auth (`@convex-dev/auth`) issues a JWT.
2. JWT audience = `convex`. JWKS at `<CONVEX_SITE_URL>/.well-known/jwks.json`.
3. External backend (`backend/reference-api`) verifies the JWT via JWKS — no shared secret.

### Multi-tenancy
- Every resource carries `workspaceId` (see `schema.ts`).
- `WorkspaceProvider` (`frontend/dashboard/src/lib/workspace-provider.tsx`) holds the
  current workspace in React context, persisted to localStorage.
- All dashboard queries pass `{ workspaceId }` (or `"skip"` until selected).

### Realtime device streaming
1. `windows-agent` (Electron) captures screen → WebRTC peer connection.
2. `backend/relay` pairs agent ↔ viewer by session ID, relays ICE candidates.
3. `frontend/dashboard` viewer page (`devices/[deviceId]/page.tsx`) renders the stream
   with a performance panel (latency, FPS, codec, bitrate, P2P vs relay).

### Background jobs
- Created via `api.jobs.create` (Convex mutation), run by Convex cron/scheduler.
- `jobs.listPaged` uses `usePaginatedQuery` (paginated, not unbounded collect).

## 8. Commands

From the repo root (Bun):

```bash
bun install                  # install all workspace deps
bun dev                      # turbo dev --parallel (all apps)
bun dev:app                  # only @v1/app
bun build                    # turbo build
bun test                     # turbo test --parallel
bun typecheck                # turbo typecheck
bun lint                     # turbo lint + sherif (workspace deps)
bun lint:repo:fix            # auto-fix workspace dep issues
bun format                   # biome format --write .
bun clean                    # git clean -xdf node_modules
bun clean:workspaces         # turbo clean
```

Per-package (run inside the package dir):

```bash
cd backend/convex && bun dev      # convex dev --tail-logs
cd backend/convex && bun test      # vitest (security.test.ts)
cd shared/email && bun dev         # email dev -p 3003
cd backend/relay && bun dev        # tsx watch src/index.ts
cd windows-agent && npm run dev:electron   # Electron + Vite
cd e2e && npx playwright install && node p2-idor.js
```

## 9. Environment variables

See [`ENV.md`](./ENV.md) for the full, validated list per package. Summary:

| Var                              | Where              | Purpose                              |
| -------------------------------- | ------------------ | ------------------------------------ |
| `NEXT_PUBLIC_CONVEX_URL`         | app, web           | Convex deployment URL (client)       |
| `CONVEX_SITE_URL`                | backend            | Convex site URL (JWKS, OIDC)         |
| `NEXT_PUBLIC_BACKEND_URL`        | app                | External backend base (DIRECT path) |
| `NEXT_PUBLIC_RELAY_URL`          | app                | WebSocket relay URL                  |
| `RESEND_API_KEY`                 | app, backend       | Resend email delivery                |
| `SMTP_HOST/PORT/USER/PASS/FROM`  | backend (Convex)   | SMTP for auth emails (Mailpit/Resend)|
| `NEXT_PUBLIC_OPENPANEL_CLIENT_ID`| app, web, analytics| OpenPanel client                     |
| `OPENPANEL_SECRET_KEY`           | backend, analytics | OpenPanel server secret              |
| `NEXT_PUBLIC_SENTRY_DSN`         | app                | Sentry/GlitchTip DSN                 |
| `AUTH_GOOGLE_ID/SECRET`          | backend            | Google OAuth (needs stable domain)   |
| `POLAR_ORGANIZATION_TOKEN`       | backend            | Polar billing                        |
| `PORT`                           | relay, backend-echo| Service port                         |

## 10. Conventions

- **Package scope**: `@v1/*` (rename via `project.config.ts` + deploy notes).
- **Imports**: apps use `@/*` → `./src/*`; cross-package via `@v1/<pkg>`.
- **TypeScript**: strict everywhere; `noUncheckedIndexedAccess` in base config.
- **Lint/format**: Biome at root; oxlint only in `windows-agent`.
- **Commits**: keep `session.md` updated per the user preference.
- **Generated code**: never edit `packages/backend/convex/_generated/`.
- **Internal/seed functions**: gated behind `DEV_SEED` (see `devGuard.ts`).