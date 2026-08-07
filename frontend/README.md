# frontend/

All user-facing web apps (Next.js). Each is a Bun workspace package.

| Folder | Package | Port | What it is |
| --- | --- | --- | --- |
| `dashboard/` | `@v1/app` | 3000 | The main product UI — multi-tenant dashboard, devices, jobs, files, settings |
| `marketing/` | `@v1/web` | 3001 | The public marketing site (landing, privacy, terms) |

## Run

```bash
bun dev:app      # dashboard only (port 3000)
bun dev:web      # marketing only (port 3001)
bun dev          # both, in parallel
```

## Backend access (dashboard)

The dashboard talks to the external backend two ways — see
`dashboard/src/lib/backend-client.ts`:
- **DIRECT** — browser → backend with the Convex JWT (verified via JWKS).
- **PROXY** — browser → Convex action → backend with a service key + userId.