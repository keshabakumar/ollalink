/**
 * Performance tracker — aggregates session stats for the UI.
 *
 * Inspired by QuickDesk's `ui/video-stats.js`, but simplified for our
 * agent-side view (we track bytes *sent*, not received).
 */

import type { PerfStats, SessionState, ConnectionMode } from "./session";

export interface DisplayStats {
  state: SessionState;
  mode: ConnectionMode;
  connectionLabel: string;
  modeLabel: string;
  fps: number;
  bitrateMbps: number;
  networkMs: number;
  totalBytesMB: number;
  videoCodec: string;
}

export function formatStats(stats: PerfStats): DisplayStats {
  const modeLabel =
    stats.mode === "p2p"
      ? "P2P Direct"
      : stats.mode === "relay"
        ? "Relay"
        : "Connecting";

  const connectionLabel =
    stats.connectionState === "connected" || stats.connectionState === "streaming"
      ? "Connected"
      : stats.connectionState === "connecting"
        ? "Connecting"
        : stats.connectionState === "reconnecting"
          ? "Reconnecting"
          : stats.connectionState === "failed"
            ? "Failed"
            : stats.connectionState === "disconnected"
              ? "Disconnected"
              : "Idle";

  return {
    state: stats.connectionState as SessionState,
    mode: stats.mode,
    connectionLabel,
    modeLabel,
    fps: stats.fps,
    bitrateMbps: stats.bitrate / 1_000_000,
    networkMs: stats.networkMs,
    totalBytesMB: stats.totalBytesSent / 1_048_576,
    videoCodec: stats.videoCodec,
  };
}