# @v1/relay

Standalone TypeScript WebSocket relay for WebRTC signaling + fallback video
relay. Pairs an `windows-agent` (agent) with a dashboard viewer by session ID,
exchanges ICE candidates, and passes through binary MSE video chunks when P2P
isn't available.

## Features

- Per-session pairing (agent ↔ viewer) with unique session IDs
- Heartbeat / keepalive with configurable stale-session cleanup
- Graceful reconnection (same role can reconnect to the same session)
- Binary pass-through for video chunks + JSON signaling
- `/stats` endpoint for monitoring (per-session bytes, messages, uptime)
- CORS headers on health/stats endpoints

## Commands

```bash
bun dev      # tsx watch src/index.ts
bun build    # tsc → dist/
bun start    # node dist/index.js
```

## Environment

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `8080` | WebSocket server port |
| `HEARTBEAT_INTERVAL_MS` | `15000` | Ping interval |
| `STALE_SESSION_TIMEOUT_MS` | `60000` | Stale session cleanup timeout |

Copy `.env.example` to `.env` for local dev. Deployed via `Dockerfile`.