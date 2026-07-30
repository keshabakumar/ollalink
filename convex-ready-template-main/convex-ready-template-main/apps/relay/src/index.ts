import { WebSocketServer, WebSocket } from "ws";
import http from "node:http";

const PORT = Number(process.env.PORT || 8080);

interface ClientConnection {
  ws: WebSocket;
  sessionId: string;
  role: "agent" | "viewer";
}

const sessions = new Map<string, { agent?: WebSocket; viewer?: WebSocket }>();

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", activeSessions: sessions.size }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws: WebSocket, req) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const sessionId = url.searchParams.get("sessionId");
  const role = url.searchParams.get("role") as "agent" | "viewer";

  if (!sessionId || !role || (role !== "agent" && role !== "viewer")) {
    ws.close(4001, "Invalid parameters. Required: sessionId and role ('agent' | 'viewer')");
    return;
  }

  let session = sessions.get(sessionId);
  if (!session) {
    session = {};
    sessions.set(sessionId, session);
  }

  if (role === "agent") {
    if (session.agent) {
      session.agent.close(4002, "Replaced by new agent connection");
    }
    session.agent = ws;
    console.log(`[Relay] Agent connected for session ${sessionId}`);
  } else {
    if (session.viewer) {
      session.viewer.close(4002, "Replaced by new viewer connection");
    }
    session.viewer = ws;
    console.log(`[Relay] Viewer connected for session ${sessionId}`);
  }

  // Notify counterpart if connected
  const counterpart = role === "agent" ? session.viewer : session.agent;
  if (counterpart && counterpart.readyState === WebSocket.OPEN) {
    counterpart.send(JSON.stringify({ type: "peer_connected", role }));
    ws.send(JSON.stringify({ type: "peer_connected", role: role === "agent" ? "viewer" : "agent" }));
  }

  ws.on("message", (data: WebSocket.RawData, isBinary: boolean) => {
    const session = sessions.get(sessionId);
    if (!session) return;
    const peer = role === "agent" ? session.viewer : session.agent;

    if (peer && peer.readyState === WebSocket.OPEN) {
      // Direct pass-through for binary video/input packets or JSON signaling
      peer.send(data, { binary: isBinary });
    }
  });

  ws.on("close", () => {
    console.log(`[Relay] ${role} disconnected from session ${sessionId}`);
    const session = sessions.get(sessionId);
    if (!session) return;

    if (role === "agent") {
      delete session.agent;
      if (session.viewer && session.viewer.readyState === WebSocket.OPEN) {
        session.viewer.send(JSON.stringify({ type: "peer_disconnected", role: "agent" }));
      }
    } else {
      delete session.viewer;
      if (session.agent && session.agent.readyState === WebSocket.OPEN) {
        session.agent.send(JSON.stringify({ type: "peer_disconnected", role: "viewer" }));
      }
    }

    if (!session.agent && !session.viewer) {
      sessions.delete(sessionId);
    }
  });

  ws.on("error", (err) => {
    console.error(`[Relay] Error on ${role} connection (${sessionId}):`, err);
  });
});

server.listen(PORT, () => {
  console.log(`[Relay Server] Listening on port ${PORT}`);
});
