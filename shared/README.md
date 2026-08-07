# shared/

Libraries shared across `frontend/` and `backend/`. Each is a Bun workspace
package consumed via `workspace:*`.

| Folder | Package | What it is |
| --- | --- | --- |
| `ui/` | `@v1/ui` | shadcn/Radix component library (button, dialog, input, …) |
| `email/` | `@v1/email` | React Email templates |
| `analytics/` | `@v1/analytics` | OpenPanel client/server/events |
| `logger/` | `@v1/logger` | pino logger |
| `tooling-typescript/` | `@v1/typescript` | Shared tsconfig bases (base/nextjs/react-library) |

## Usage

```ts
import { Button } from "@v1/ui/button";
import { logger } from "@v1/logger";
import { setupAnalytics } from "@v1/analytics/server";
```

## Run

```bash
cd shared/ui && bun lint          # biome check .
cd shared/email && bun dev        # email dev -p 3003 (live preview)
cd shared/tooling-typescript       # tsconfig bases — no build step
```