# @v1/app — Ollalink Dashboard

The main product UI. Next.js 14 App Router, locale-segmented routes, Convex
Auth, multi-tenant workspaces, and a live device viewer.

## Layout

```
src/
├── app/
│   ├── [locale]/
│   │   ├── (dashboard)/         # Authenticated area (sidebar + topbar)
│   │   │   ├── layout.tsx        # WorkspaceProvider + Sidebar + Topbar
│   │   │   ├── page.tsx          # Home overview (stat cards + activity)
│   │   │   ├── _components/      # sidebar, topbar, command-palette, etc.
│   │   │   ├── analytics/        # Audit log viewer
│   │   │   ├── devices/          # Device list + [deviceId] live viewer
│   │   │   ├── files/           # File storage (paginated)
│   │   │   ├── jobs/            # Background jobs (paginated)
│   │   │   ├── platform/        # Platform/admin page
│   │   │   └── settings/        # Profile + billing + account security
│   │   ├── (public)/login/      # Sign-in page
│   │   ├── onboarding/          # First-run username setup
│   │   ├── layout.tsx          # Root locale layout (providers, fonts)
│   │   ├── error.tsx / not-found.tsx
│   │   └── [...rest]/          # Catch-all 404
│   ├── convex-client-provider.tsx
│   └── global-error.tsx
├── components/                 # Cross-page components (auth-form, sessions-card…)
├── lib/
│   ├── backend-client.ts       # useDirectBackend / useProxyBackend hooks
│   ├── backend.config.ts       # DIRECT vs PROXY route table
│   ├── workspace-provider.tsx  # React context for current workspace
│   └── useWorkspace.ts        # Re-export of context hook
├── locales/                    # i18n (en, es, fr) via next-international
├── env.mjs                     # t3-env validated env vars
├── instrumentation.ts          # Sentry server-side import
└── middleware.ts              # Locale + auth middleware
```

## Backend access

The dashboard talks to the external backend two ways (see
`src/lib/backend-client.ts`):

- **DIRECT** — browser → backend with the Convex JWT; backend verifies via JWKS.
- **PROXY** — browser → Convex action → backend with a service key + userId.

## Commands

```bash
bun dev        # next dev -p 3000
bun build      # next build
bun start      # next start
bun lint       # biome lint
bun typecheck  # tsc --noEmit
```

## Environment

Copy `.env.example` to `.env.local`. See root [`ENV.md`](../../ENV.md).