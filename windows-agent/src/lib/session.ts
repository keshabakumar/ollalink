/**
 * Agent session manager — owns the relay WebSocket + WebRTC peer connection.
 *
 * Inspired by QuickDesk's `protocol/session.js` state machine: a single class
 * that owns the transport, exposes a clean state enum, and emits typed events
 * so the UI never touches raw sockets.
 *
 * Responsibilities:
 *  - Connect to the relay WS as `role=agent`
 *  - Capture the screen stream (shared by WebRTC + MSE fallback)
 *  - Negotiate WebRTC P2P (offer/answer/ICE over the relay WS)
 *  - Fall back to MSE-over-WS (MediaRecorder) when P2P fails
 *  - Route incoming viewer messages (input, clipboard, monitor switch, …)
 *  - Track per-session performance (bytes sent, fps, connection state)
 */

export type SessionState =
  | "idle"
  | "connecting"
  | "connected"
  | "streaming"
  | "reconnecting"
  | "disconnected"
  | "failed";

export type ConnectionMode = "p2p" | "relay" | "none";

export interface PerfStats {
  connectionState: string;
  mode: ConnectionMode;
  videoCodec: string;
  bitrate: number;
  fps: number;
  captureMs: number;
  encodeMs: number;
  networkMs: number;
  totalBytesSent: number;
}

export interface ViewerMessage {
  type: string;
  [key: string]: any;
}

export type SessionEventListener = (detail: {
  state: SessionState;
  mode: ConnectionMode;
  stats: PerfStats;
}) => void;

export type MessageHandler = (msg: ViewerMessage) => void;

const DEFAULT_BITRATE = 1_500_000; // 1.5 Mbps
const CHUNK_INTERVAL_MS = 100; // 10 chunks/sec

export class AgentSession {
  state: SessionState = "idle";
  mode: ConnectionMode = "none";
  stats: PerfStats = {
    connectionState: "idle",
    mode: "none",
    videoCodec: "VP8",
    bitrate: DEFAULT_BITRATE,
    fps: 0,
    captureMs: 0,
    encodeMs: 0,
    networkMs: 0,
    totalBytesSent: 0,
  };

  private ws: WebSocket | null = null;
  private pc: RTCPeerConnection | null = null;
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private clipboardTimer: ReturnType<typeof setInterval> | null = null;
  private lastClipboard = "";
  private bytesSent = 0;
  private frameCount = 0;
  private lastFpsUpdate = Date.now();
  private sessionId: string | null = null;
  private listeners = new Set<SessionEventListener>();
  private messageHandlers: MessageHandler[] = [];
  private recordingStream: any = null;
  private recordingFilePath: string | null = null;

  /** STUN + optional TURN (self-hosted coturn). */
  private iceServers(): RTCIceServer[] {
    const servers: RTCIceServer[] = [
      { urls: "stun:stun.l.google.com:19302" },
    ];
    const turnUrl = import.meta.env.VITE_TURN_URL as string | undefined;
    if (turnUrl) {
      servers.push({
        urls: turnUrl,
        username: (import.meta.env.VITE_TURN_USER as string) || "ollalink",
        credential:
          (import.meta.env.VITE_TURN_PASS as string) || "ollalink-turn-secret",
      });
    }
    return servers;
  }

  onStateChange(listener: SessionEventListener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onMessage(handler: MessageHandler) {
    this.messageHandlers.push(handler);
    return () => {
      this.messageHandlers = this.messageHandlers.filter((h) => h !== handler);
    };
  }

  private emit() {
    for (const l of this.listeners) {
      l({ state: this.state, mode: this.mode, stats: { ...this.stats } });
    }
  }

  private setState(s: SessionState) {
    this.state = s;
    this.stats.connectionState = s;
    this.emit();
  }

  private setMode(m: ConnectionMode) {
    this.mode = m;
    this.stats.mode = m;
    this.emit();
  }

  /** Connect to the relay and start streaming to the viewer. */
  async connect(sessionId: string) {
    if (this.sessionId === sessionId && this.ws?.readyState === WebSocket.OPEN)
      return;
    this.disconnect();
    this.sessionId = sessionId;
    this.setState("connecting");

    const relayUrl =
      (import.meta.env.VITE_RELAY_URL as string) || "ws://localhost:8080";
    const ws = new WebSocket(`${relayUrl}?sessionId=${sessionId}&role=agent`);
    ws.binaryType = "arraybuffer";

    ws.onopen = async () => {
      this.setState("connected");
      await this.startVideoStream(ws);
      await this.sendMonitorList(ws);
      try {
        await this.startWebRTC(ws);
      } catch (err) {
        console.error("[Session] WebRTC setup failed — staying on MSE fallback", err);
      }
      this.startClipboardSync(ws);
    };

    ws.onmessage = (event) => {
      if (typeof event.data !== "string") return;
      try {
        const msg = JSON.parse(event.data) as ViewerMessage;
        this.handleMessage(ws, msg);
      } catch (e) {
        console.error("[Session] Invalid viewer message", e);
      }
    };

    ws.onclose = () => {
      console.log("[Session] Relay disconnected", sessionId);
      this.disconnect();
    };

    ws.onerror = (err) => {
      console.error("[Session] Relay connection error", err);
      this.setState("failed");
    };

    this.ws = ws;
  }

  /** Full teardown — close WS, WebRTC, recorder, clipboard timer. */
  disconnect() {
    if (this.ws) {
      try { this.ws.close(); } catch {}
      this.ws = null;
    }
    if (this.recorder) {
      try {
        if (this.recorder.state !== "inactive") this.recorder.stop();
      } catch {}
      this.recorder = null;
    }
    if (this.pc) {
      try { this.pc.close(); } catch {}
      this.pc = null;
    }
    this.stream = null;
    if (this.clipboardTimer) {
      clearInterval(this.clipboardTimer);
      this.clipboardTimer = null;
    }
    this.bytesSent = 0;
    this.frameCount = 0;
    this.lastClipboard = "";
    this.sessionId = null;
    this.recordingStream = null;
    this.recordingFilePath = null;
    this.setMode("none");
    this.setState("idle");
  }

  // ─── Video capture (MSE fallback) ───────────────────────────────────────

  private async startVideoStream(ws: WebSocket, sourceId?: string) {
    try {
      const bridge = (window as any).electron;
      if (!bridge) throw new Error("Electron bridge not available");
      const stream: MediaStream = await bridge.getScreenStream(sourceId);
      this.stream = stream;

      const recorder = new MediaRecorder(stream, {
        mimeType: "video/webm;codecs=vp8",
        videoBitsPerSecond: this.stats.bitrate,
      });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
          const t0 = Date.now();
          ws.send(e.data);
          this.bytesSent += e.data.size;
          this.frameCount++;
          this.maybeAppendRecording(e.data);
          this.updateFps(t0);
        }
      };

      recorder.start(CHUNK_INTERVAL_MS);
      this.recorder = recorder;
      this.setState("streaming");
      console.log("[Session] Video stream started", recorder.mimeType);
    } catch (err) {
      console.error("[Session] Failed to start video stream", err);
    }
  }

  private updateFps(sendStart: number) {
    const now = Date.now();
    if (now - this.lastFpsUpdate >= 1000) {
      this.stats.fps = this.frameCount;
      this.frameCount = 0;
      this.lastFpsUpdate = now;
      this.stats.networkMs = Date.now() - sendStart;
      this.stats.totalBytesSent = this.bytesSent;
      this.emit();
    }
  }

  // ─── WebRTC P2P ─────────────────────────────────────────────────────────

  private async startWebRTC(ws: WebSocket) {
    const bridge = (window as any).electron;
    const stream: MediaStream =
      this.stream || (bridge ? await bridge.getScreenStream() : null);
    if (!stream) return;
    this.stream = stream;

    const pc = new RTCPeerConnection({ iceServers: this.iceServers() });
    this.pc = pc;

    for (const track of stream.getVideoTracks()) {
      pc.addTrack(track, stream);
    }

    pc.onicecandidate = (e) => {
      if (e.candidate && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({ type: "webrtc_ice", candidate: e.candidate.toJSON() }),
        );
      }
    };

    pc.onconnectionstatechange = () => {
      console.log("[Session] WebRTC state:", pc.connectionState);
      this.stats.connectionState = pc.connectionState;
      if (pc.connectionState === "connected") {
        // Viewer confirms via webrtc_connected message; don't set p2p yet.
      }
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        this.setMode("relay");
      }
      this.emit();
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    ws.send(JSON.stringify({ type: "webrtc_offer", sdp: offer.sdp }));
    console.log("[Session] WebRTC offer sent");
  }

  // ─── Monitor list (multi-monitor) ───────────────────────────────────────

  private async sendMonitorList(ws: WebSocket) {
    try {
      const bridge = (window as any).electron;
      if (!bridge?.getScreenSources) return;
      const sources = await bridge.getScreenSources();
      if (sources.length > 0 && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "monitors", sources }));
      }
    } catch (err) {
      console.error("[Session] Failed to list monitors", err);
    }
  }

  // ─── Clipboard sync ─────────────────────────────────────────────────────

  private startClipboardSync(ws: WebSocket) {
    if (this.clipboardTimer) clearInterval(this.clipboardTimer);
    this.lastClipboard = "";
    this.clipboardTimer = setInterval(async () => {
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      try {
        const bridge = (window as any).electron;
        if (!bridge?.getClipboard) return;
        const text = await bridge.getClipboard();
        if (typeof text === "string" && text && text !== this.lastClipboard) {
          this.lastClipboard = text;
          ws.send(JSON.stringify({ type: "clipboard", text }));
        }
      } catch {}
    }, 1000);
  }

  // ─── Recording ──────────────────────────────────────────────────────────

  private maybeAppendRecording(data: Blob) {
    if (!this.recordingStream || !data.arrayBuffer) return;
    data.arrayBuffer()
      .then((buf: ArrayBuffer) => {
        const bridge = (window as any).electron;
        if (bridge?.appendRecordingChunk) {
          bridge.appendRecordingChunk(this.recordingStream, buf);
        }
      })
      .catch(() => {});
  }

  async startRecording() {
    const bridge = (window as any).electron;
    if (!bridge?.startRecording) return;
    const rec = await bridge.startRecording();
    if (rec) {
      this.recordingStream = rec.stream;
      this.recordingFilePath = rec.filePath;
      this.send({ type: "recording_started", filePath: rec.filePath });
      console.log("[Session] Recording started:", rec.filePath);
    }
  }

  async stopRecording() {
    const bridge = (window as any).electron;
    if (!bridge?.stopRecording || !this.recordingStream || !this.recordingFilePath)
      return;
    await bridge.stopRecording(this.recordingStream, this.recordingFilePath);
    this.send({ type: "recording_stopped", filePath: this.recordingFilePath });
    console.log("[Session] Recording stopped:", this.recordingFilePath);
    this.recordingStream = null;
    this.recordingFilePath = null;
  }

  // ─── Message routing ────────────────────────────────────────────────────

  private send(msg: object) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private async handleMessage(ws: WebSocket, msg: ViewerMessage) {
    // Ping/pong for RTT measurement.
    if (msg.type === "ping" && typeof msg.t === "number") {
      this.send({ type: "pong", t: msg.t });
      return;
    }

    // Adaptive bitrate feedback from viewer.
    if (msg.type === "set_bitrate" && typeof msg.bps === "number") {
      if (this.recorder && this.recorder.state === "recording") {
        try {
          (this.recorder as any).videoBitsPerSecond = msg.bps;
          this.stats.bitrate = msg.bps;
          this.emit();
          console.log("[Session] Bitrate adjusted to", msg.bps);
        } catch {}
      }
      return;
    }

    // Monitor switch — restart video + WebRTC with the new source.
    if (msg.type === "select_monitor" && typeof msg.sourceId === "string") {
      console.log("[Session] Switching monitor to", msg.sourceId);
      if (this.recorder) {
        try { if (this.recorder.state !== "inactive") this.recorder.stop(); } catch {}
        this.recorder = null;
      }
      if (this.pc) {
        try { this.pc.close(); } catch {}
        this.pc = null;
      }
      this.setMode("none");
      await this.startVideoStream(ws, msg.sourceId);
      try { await this.startWebRTC(ws); } catch (err) {
        console.error("[Session] WebRTC restart after monitor switch failed", err);
      }
      return;
    }

    // WebRTC signaling — viewer answered our offer.
    if (msg.type === "webrtc_answer" && typeof msg.sdp === "string") {
      if (this.pc) {
        try {
          await this.pc.setRemoteDescription({ type: "answer", sdp: msg.sdp });
          console.log("[Session] WebRTC remote description set");
        } catch (err) {
          console.error("[Session] setRemoteDescription failed", err);
        }
      }
      return;
    }

    // WebRTC signaling — ICE candidate from viewer.
    if (msg.type === "webrtc_ice" && msg.candidate) {
      if (this.pc) {
        try { await this.pc.addIceCandidate(msg.candidate); } catch (err) {
          console.error("[Session] addIceCandidate failed", err);
        }
      }
      return;
    }

    // Viewer confirmed P2P track is playing — stop MSE fallback.
    if (msg.type === "webrtc_connected") {
      this.setMode("p2p");
      if (this.recorder && this.recorder.state === "recording") {
        try { this.recorder.stop(); } catch {}
        this.recorder = null;
        console.log("[Session] P2P active — stopped MSE fallback recorder");
      }
      return;
    }

    // Recording control.
    if (msg.type === "start_recording") {
      await this.startRecording();
      return;
    }
    if (msg.type === "stop_recording") {
      await this.stopRecording();
      return;
    }

    // Clipboard from viewer → write to local clipboard.
    if (msg.type === "set_clipboard" && typeof msg.text === "string") {
      const bridge = (window as any).electron;
      if (bridge?.setClipboard) {
        try {
          await bridge.setClipboard(msg.text);
          this.lastClipboard = msg.text; // avoid echoing back
        } catch (err) {
          console.error("[Session] setClipboard failed", err);
        }
      }
      return;
    }

    // Delegate input + any other messages to registered handlers.
    for (const h of this.messageHandlers) {
      h(msg);
    }
  }
}