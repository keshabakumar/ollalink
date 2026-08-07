# frontend/

The user-facing web app (Next.js). A Bun workspace package.

| Folder | Package | Port | What it is |
| --- | --- | --- | --- |
| `dashboard/` | `@v1/app` | 3000 | The product UI — multi-tenant dashboard, devices, jobs, files, settings |

## Run

```bash
bun dev:app      # dashboard (port 3000)
bun dev          # all apps, in parallel
```

## Backend access (dashboard)

The dashboard talks to the external backend two ways — see
`dashboard/src/lib/backend-client.ts`:
- **DIRECT** — browser → backend with the Convex JWT (verified via JWKS).
- **PROXY** — browser → Convex action → backend with a service key + userId.