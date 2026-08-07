# backend/

All server-side services.

| Folder | Package | Port | What it is |
| --- | --- | --- | --- |
| `convex/` | `@v1/backend` | 3210/3211 | **The API** — Convex functions, schema, auth, JWKS/OIDC, jobs, billing |
| `relay/` | `@v1/relay` | 8080 | WebSocket relay for WebRTC signaling + video fallback |
| `reference-api/` | — | 4000 | Reference external backend (Node) — the swappable real backend |

## Run

```bash
cd backend/convex && bun dev      # convex dev --tail-logs (the API)
cd backend/relay && bun dev       # tsx watch src/index.ts (the relay)
cd backend/reference-api && node server.mjs   # the reference backend
```

## Which is "the backend"?

- **`convex/`** is the control-plane backend (auth, users, orgs, jobs, files,
  audit, billing) — this is what the dashboard talks to for all platform data.
- **`reference-api/`** is a ~120-line reference for *your* real backend (the
  domain/AI logic). Swap it for any backend by changing `BACKEND_BASE_URL` +
  `NEXT_PUBLIC_BACKEND_URL`. See `scripts/TEMPLATE.md`.
- **`relay/`** is the realtime signaling server for remote device streaming.