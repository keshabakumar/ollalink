# @v1/logger

Thin shared wrapper around [`pino`](https://github.com/pinojs/pino).

```ts
import { logger } from "@v1/logger";

logger.info("hello");
logger.error({ err }, "request failed");
```

## Commands

```bash
bun lint       # biome check .
bun format     # biome format --write .
bun typecheck  # tsc --noEmit
```