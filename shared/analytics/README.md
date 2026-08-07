# @v1/analytics

OpenPanel analytics integration. Three entry points:

```ts
import { setupAnalytics } from "@v1/analytics/server"; // server-side identify
import { Provider, track } from "@v1/analytics/client";  // client component + track()
import { events } from "@v1/analytics/events";           // event name constants
```

## Layout

```
src/
├── server.ts   # setupAnalytics() — uses OPENPANEL_SECRET_KEY
├── client.tsx  # <Provider/> + track() — uses NEXT_PUBLIC_OPENPANEL_CLIENT_ID
└── events.ts   # event name constants
```

## Commands

```bash
bun lint       # biome check .
bun format     # biome --write .
bun typecheck  # tsc --noEmit
```

## Environment

- `NEXT_PUBLIC_OPENPANEL_CLIENT_ID` — client id (public).
- `OPENPANEL_SECRET_KEY` — server secret (server-only).

In non-production, `track()` logs the event via `@v1/logger` instead of sending.