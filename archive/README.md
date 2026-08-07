# archive/

Reference-only snapshots kept for historical context. **Not** part of the
active build, workspace, or deploy runbook. Do not edit — treat as read-only.

| Folder | What it is |
| --- | --- |
| `agent-win-archive/` | The original Rust Windows agent placeholder (`@v1/agent-win`). Non-functional (infinite sleep loop, gradient generator, empty service stub) — never compiled. Kept as reference for Phase 3 (DXGI capture + H.264), to be written from scratch. The **active** Windows agent is the Electron app at `/windows-agent`. |
| `convex-ready-template-main/` | Archived copy of the upstream `convex-ready-template` this project forked from. Used only by `scripts/set-jwks.*` to read the generated JWKS/private key. |

> Note: `agent-win-archive` was previously a Bun workspace member under
> `apps/*` (package `@v1/agent-win`). Moving it here removed it from the
> workspace — nothing in the active codebase imports `@v1/agent-win`, so
> `bun install` will simply no longer link it. Run `bun install` to refresh
> `bun.lock` after this move.