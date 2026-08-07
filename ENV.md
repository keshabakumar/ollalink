# Environment Variables

> Complete, validated reference for every env var the Ollalink stack reads.
> Copy the relevant `.env.example` into `.env.local` (apps) or set them on the
> Convex dashboard / deploy host. Last updated: 2026-08-07.

## `frontend/dashboard` (dashboard) — `frontend/dashboard/.env.example`

Validated by `src/env.mjs` (t3-env). Copy to `.env.local`.

| Variable | Required | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_CONVEX_URL` | ✅ | Convex deployment URL (from `npx convex dev`/`deploy`) |
| `NEXT_PUBLIC_OPENPANEL_CLIENT_ID` | optional | OpenPanel analytics client id |
| `NEXT_PUBLIC_SENTRY_DSN` | optional | Sentry / GlitchTip DSN |
| `NEXT_PUBLIC_APP_URL` | optional | Public dashboard URL (redirects, metadata) |
| `NEXT_PUBLIC_BACKEND_URL` | optional | External backend base URL (DIRECT path) |
| `NEXT_PUBLIC_RELAY_URL` | optional | WebSocket relay URL (defaults `ws://localhost:8080`) |
| `NEXT_PUBLIC_CAL_LINK` | optional | Cal.com booking link |
| `RESEND_API_KEY` | optional | Resend API key (if using Resend from the app) |
| `SENTRY_AUTH_TOKEN` | optional | Sentry auth token (sourcemaps) |
| `SENTRY_ORG` / `SENTRY_PROJECT` | optional | Sentry org/project |
| `PORT` | optional | Next.js dev port (default 3000) |
| `VERCEL_URL` | optional | Auto-set by Vercel previews |

## `frontend/marketing` (marketing) — `frontend/marketing/.env.example`

Validated by `src/env.ts` (t3-env). Copy to `.env.local`.

| Variable | Required | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_CONVEX_URL` | ✅ | Convex deployment URL |
| `NEXT_PUBLIC_APP_URL` | optional | Dashboard URL (header links) |
| `NEXT_PUBLIC_CAL_LINK` | optional | Cal.com booking link |
| `NEXT_PUBLIC_OPENPANEL_CLIENT_ID` | optional | OpenPanel client id |

## `backend/convex` (Convex) — `backend/convex/.env.example`

Validated by `convex/env.ts` (t3-env, gated on `VALIDATE_ENV`). Set on the
Convex dashboard or via `convex env set`.

| Variable | Required | Description |
| --- | --- | --- |
| `CONVEX_SITE_URL` | ✅ | Convex site URL (JWKS at `/.well-known/jwks.json`, OIDC) |
| `SITE_URL` | ✅ | Public site URL (email links) |
| `POLAR_ORGANIZATION_TOKEN` | ✅ | Polar billing token |
| `POLAR_WEBHOOK_SECRET` | ✅ | Polar webhook signing secret |
| `AUTH_GOOGLE_ID` | ✅ | Google OAuth client id (needs stable domain) |
| `AUTH_GOOGLE_SECRET` | ✅ | Google OAuth client secret |
| `RESEND_API_KEY` | optional | Resend API key |
| `RESEND_SENDER_EMAIL_AUTH` | optional | From address for auth emails |
| `LOOPS_FORM_ID` | optional | Loops form id |
| `SMTP_HOST` | optional | SMTP host (Mailpit `localhost:1025` or Resend SMTP) |
| `SMTP_PORT` | optional | SMTP port |
| `SMTP_USER` / `SMTP_PASS` | optional | SMTP credentials |
| `SMTP_FROM` | optional | SMTP from address |
| `VALIDATE_ENV` | optional | Set `true` to enforce env validation |
| `DEV_SEED` | optional | Gate for internal seed/test functions |

## `backend/relay` — `backend/relay/.env.example`

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `8080` | WebSocket server port |
| `HEARTBEAT_INTERVAL_MS` | `15000` | Ping interval |
| `STALE_SESSION_TIMEOUT_MS` | `60000` | Stale session cleanup timeout |

## `backend/reference-api` — `backend/reference-api/.env.example`

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `4000` | HTTP server port |
| `CONVEX_JWKS_URL` | — | JWKS URL to verify Convex JWTs |
| `CONVEX_AUDIENCE` | `convex` | Expected JWT audience |

## `windows-agent`

Reads `NEXT_PUBLIC_CONVEX_URL` and `NEXT_PUBLIC_RELAY_URL` at build time
(see `src/App.tsx`). Set in `windows-agent/.env` for local dev.

## `self-hosted/` (GlitchTip / Mailpit)

See `self-hosted/docker-compose.yml` and `self-hosted/.env` (created by
`deploy/26-https-cutover.sh`). Key vars: `NEXT_PUBLIC_SENTRY_DSN`,
GlitchTip `SECRET_KEY`, `ALLOWED_HOSTS`, Mailpit `SMTP_HOST`/`SMTP_PORT`.