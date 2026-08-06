/**
 * Ollalink Relay Server
 *
 * WebSocket relay for WebRTC signaling + fallback video relay.
 * Handles agent ↔ viewer session pairing, ICE candidate exchange,
 * and binary pass-through for MSE fallback video chunks.
 *
 * Features:
 * - Session management with unique session IDs
 * - Heartbeat / keepalive with configurable timeout
 * - Automatic stale session cleanup
 * - Stats endpoint for monitoring
 * - Graceful reconnection (agent/viewer can reconnect to same session)
 * - Binary pass-through for video chunks and JSON signaling
 * - CORS headers for health checks
 */

import { WebSocketServer, WebSocket } from "ws";
import http from "node:http";

const PORT = Number(process.env.PORT || 8080);
const HEARTBEAT_INTERVAL_MS = Number(process.env.HEARTBEAT_INTERVAL_MS || 15000);
const STALE_SESSION_TIMEOUT_MS = Number(process.env.STALE_SESSION_TIMEOUT_MS || 60000);

type Role = "agent" | "viewer";

interface SessionPeer {
  ws: WebSocket;
  connectedAt: number;
  lastHeartbeat: number;
  bytesTransferred: number;
}

interface Session {
  id: string;
  agent: SessionPeer | null;
  viewer: SessionPeer | null;
  createdAt: number;
  totalBytesTransferred: number;
  messageCount: number;
}

const sessions = new Map<string, Session>();

// --- Stats counters ---
let totalConnections = 0;
let totalSessionsCreated = 0;

// --- HTTP server for health + stats ---
const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "ok",
        activeSessions: sessions.size,
        totalConnections,
        totalSessionsCreated,
        uptime: process.uptime(),
      }),
    );
    return;
  }

  if (req.url === "/stats") {
    const sessionStats = Array.from(sessions.values()).map((s) => ({
      id: s.id,
      agentConnected: !!s.agent,
      viewerConnected: !!s.viewer,
      createdAt: s.createdAt,
      messageCount: s.messageCount,
      bytesTransferred: s.totalBytesTransferred,
    }));
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "ok",
        activeSessions: sessions.size,
        totalConnections,
        totalSessionsCreated,
        uptime: process.uptime(),
        sessions: sessionStats,
      }),
    );
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

// --- WebSocket server ---
const wss = new WebSocketServer({ server });

function getOrCreateSession(sessionId: string): Session {
  let session = sessions.get(sessionId);
  if (!session) {
    session = {
      id: sessionId,
      agent: null,
      viewer: null,
      createdAt: Date.now(),
      totalBytesTransferred: 0,
      messageCount: 0,
    };
    sessions.set(sessionId, session);
    totalSessionsCreated++;
  }
  return session;
}

function notifyPeer(session: Session, senderRole: Role, msg: object) {
  const peer = senderRole === "agent" ? session.viewer : session.agent;
  if (peer && peer.ws.readyState === WebSocket.OPEN) {
    peer.ws.send(JSON.stringify(msg));
  }
}

function handleDisconnect(sessionId: string, role: Role) {
  const session = sessions.get(sessionId);
  if (!session) return;

  if (role === "agent") {
    session.agent = null;
  } else {
    session.viewer = null;
  }

  // Notify the remaining peer
  const remaining = role === "agent" ? session.viewer : session.agent;
  if (remaining && remaining.ws.readyState === WebSocket.OPEN) {
    remaining.ws.send(JSON.stringify({ type: "peer_disconnected", role }));
  }

  // Clean up empty sessions
  if (!session.agent && !session.viewer) {
    sessions.delete(sessionId);
  }
}

wss.on("connection", (ws: WebSocket, req) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const sessionId = url.searchParams.get("sessionId");
  const role = url.searchParams.get("role") as Role | null;

  if (!sessionId || !role || (role !== "agent" && role !== "viewer")) {
    ws.close(4001, "Missing sessionId or role parameter");
    return;
  }

  totalConnections++;
  const session = getOrCreateSession(sessionId);
  const peer: SessionPeer = {
    ws,
    connectedAt: Date.now(),
    lastHeartbeat: Date.now(),
    bytesTransferred: 0,
  };

  // Replace existing connection of the same role (reconnection scenario)
  if (role === "agent") {
    if (session.agent) {
      try { session.agent.ws.close(4002, "Replaced by new connection"); } catch {}
    }
    session.agent = peer;
  } else {
    if (session.viewer) {
      try { session.viewer.ws.close(4002, "Replaced by new connection"); } catch {}
    }
    session.viewer = peer;
  }

  console.log(
    `[Relay] ${role} connected to session ${sessionId} ` +
      `(agent=${!!session.agent}, viewer=${!!session.viewer})`,
  );

  // Notify both peers that they're connected
  if (session.agent && session.viewer) {
    session.agent.ws.send(JSON.stringify({ type: "peer_connected", role: "viewer" }));
    session.viewer.ws.send(JSON.stringify({ type: "peer_connected", role: "agent" }));
  }

  // --- Message handler ---
  ws.on("message", (data: WebSocket.RawData, isBinary: boolean) => {
    const s = sessions.get(sessionId);
    if (!s) return;

    peer.lastHeartbeat = Date.now();
    s.messageCount++;

    const target = role === "agent" ? s.viewer : s.agent;

    // Handle control messages (heartbeat)
    if (!isBinary && data instanceof Buffer && data.length <= 64) {
      try {
        const text = data.toString("utf8");
        if (text === "ping") {
          ws.send("pong");
          return;
        }
        if (text === "pong") {
          return;
        }
      } catch {}
    }

    // Pass through to the peer (binary video chunks or JSON signaling)
    if (target && target.ws.readyState === WebSocket.OPEN) {
      let bytes = 0;
      if (data instanceof Buffer) bytes = data.length;
      else if (data instanceof ArrayBuffer) bytes = data.byteLength;
      else if (Array.isArray(data)) bytes = data.reduce((sum, b) => sum + (b?.length || 0), 0);
      peer.bytesTransferred += bytes;
      s.totalBytesTransferred += bytes;
      target.ws.send(data, { binary: isBinary });
    }
  });

  ws.on("close", () => {
    console.log(`[Relay] ${role} disconnected from session ${sessionId}`);
    handleDisconnect(sessionId, role);
  });

  ws.on("error", (err) => {
    console.error(`[Relay] Error on ${role} (${sessionId}):`, err.message);
    handleDisconnect(sessionId, role);
  });
});

// --- Stale session cleanup ---
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    const agentStale = !session.agent || now - session.agent.lastHeartbeat > STALE_SESSION_TIMEOUT_MS;
    const viewerStale = !session.viewer || now - session.viewer.lastHeartbeat > STALE_SESSION_TIMEOUT_MS;

    if (agentStale && viewerStale) {
      console.log(`[Relay] Cleaning up stale session ${id}`);
      if (session.agent) try { session.agent.ws.terminate(); } catch {}
      if (session.viewer) try { session.viewer.ws.terminate(); } catch {}
      sessions.delete(id);
    }
  }
}, HEARTBEAT_INTERVAL_MS);

// --- Heartbeat ping to all connected clients ---
setInterval(() => {
  for (const session of sessions.values()) {
    for (const peer of [session.agent, session.viewer]) {
      if (peer && peer.ws.readyState === WebSocket.OPEN) {
        if (Date.now() - peer.lastHeartbeat > STALE_SESSION_TIMEOUT_MS) {
          try { peer.ws.terminate(); } catch {}
        } else {
          try { peer.ws.ping(); } catch {}
        }
      }
    }
  }
}, HEARTBEAT_INTERVAL_MS);

server.listen(PORT, () => {
  console.log(`[Ollalink Relay] Listening on port ${PORT}`);
  console.log(`[Ollalink Relay] Health: http://localhost:${PORT}/health`);
  console.log(`[Ollalink Relay] Stats:  http://localhost:${PORT}/stats`);
});
