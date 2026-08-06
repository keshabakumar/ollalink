// @ts-nocheck
"use client";

import { useWorkspace } from "@/lib/useWorkspace";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, Monitor, Maximize2, RefreshCw, Wifi, Activity, Power, Clipboard } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export default function DeviceSessionPage() {
  const params = useParams();
  const deviceId = params.deviceId as Id<"devices">;

  const device = useQuery(api.devices.get, { deviceId });
  const startSession = useMutation(api.devices.startRemoteSession);
  const endSession = useMutation(api.devices.endRemoteSession);

  const [sessionId, setSessionId] = useState<Id<"deviceSessions"> | null>(null);
  const [status, setStatus] = useState<"initializing" | "connecting" | "connected" | "disconnected">("initializing");
  const [latency, setLatency] = useState<number>(0);
  const [fps, setFps] = useState<number>(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const mseRef = useRef<{ mediaSource: MediaSource; sourceBuffer: SourceBuffer; queue: ArrayBuffer[]; lastFrameAt: number; frameCount: number } | null>(null);
  // Phase 3: real latency measurement via ping/pong RTT.
  const pingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPingAtRef = useRef<number>(0);
  // Phase 3: adaptive bitrate — track recent RTTs and tell the agent to adjust.
  const rttHistoryRef = useRef<number[]>([]);
  const currentBitrateRef = useRef<number>(1_500_000); // start at 1.5 Mbps
  // Phase 3.5: WebRTC P2P. The viewer is the receiver. STUN-only (no TURN):
  // if P2P fails (symmetric NAT), MSE-over-WS stays as the automatic fallback.
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const p2pActiveRef = useRef<boolean>(false);

  // Phase 3: Initialize MediaSource Extensions for webm playback.
  // The agent sends VP8 webm chunks from MediaRecorder; we append them to a
  // SourceBuffer and the <video> element plays them. This is the browser-native
  // way to play a live stream without WebRTC.
  const initMse = () => {
    if (!("MediaSource" in window)) {
      console.error("[Viewer] MediaSource not supported");
      return;
    }
    const mediaSource = new MediaSource();
    if (videoRef.current) {
      videoRef.current.src = URL.createObjectURL(mediaSource);
    }
    mediaSource.addEventListener("sourceopen", () => {
      try {
        const sourceBuffer = mediaSource.addSourceBuffer('video/webm;codecs="vp8"');
        sourceBuffer.mode = "sequence"; // append in order, no timestamps needed
        mseRef.current = {
          mediaSource,
          sourceBuffer,
          queue: [],
          lastFrameAt: Date.now(),
          frameCount: 0,
        };
        sourceBuffer.addEventListener("updateend", flushQueue);
      } catch (err) {
        console.error("[Viewer] MSE sourceBuffer init failed", err);
      }
    });
  };

  const flushQueue = () => {
    const mse = mseRef.current;
    if (!mse || mse.sourceBuffer.updating || mse.queue.length === 0) return;
    const next = mse.queue.shift();
    if (next) {
      try {
        mse.sourceBuffer.appendBuffer(next);
      } catch (err) {
        console.error("[Viewer] MSE append failed", err);
        // Drop the chunk on error to avoid stalling the stream.
      }
    }
  };

  const appendChunk = (data: ArrayBuffer) => {
    const mse = mseRef.current;
    if (!mse) return;

    // Track real FPS: count chunks, update HUD every second.
    mse.frameCount++;
    const now = Date.now();
    if (now - mse.lastFrameAt >= 1000) {
      setFps(mse.frameCount);
      mse.frameCount = 0;
      mse.lastFrameAt = now;
    }

    if (mse.sourceBuffer.updating || mse.queue.length > 0) {
      // Queue if the source buffer is busy or we already have pending chunks.
      mse.queue.push(data);
      // Cap the queue to avoid unbounded memory growth on slow links.
      if (mse.queue.length > 30) mse.queue.shift();
    } else {
      try {
        mse.sourceBuffer.appendBuffer(data);
      } catch (err) {
        console.error("[Viewer] MSE append failed", err);
      }
    }
  };

  // Initialize remote session
  useEffect(() => {
    if (!device) return;

    async function init() {
      try {
        setStatus("connecting");
        const sid = await startSession({ deviceId });
        setSessionId(sid);

        // Connect to WebSocket Relay Server
        const relayUrl = process.env.NEXT_PUBLIC_RELAY_URL || "ws://localhost:8080";
        const ws = new WebSocket(`${relayUrl}?sessionId=${sid}&role=viewer`);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log("[Viewer] Connected to Relay Server");
          setStatus("connected");
          toast.success("Remote session connected");
          initMse();
          // Phase 3: start ping/pong RTT measurement (every 2s).
          if (pingTimerRef.current) clearInterval(pingTimerRef.current);
          pingTimerRef.current = setInterval(() => {
            if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
            lastPingAtRef.current = Date.now();
            wsRef.current.send(JSON.stringify({ type: "ping", t: lastPingAtRef.current }));
          }, 2000);
        };

        ws.onmessage = async (event) => {
          if (typeof event.data === "string") {
            try {
              const msg = JSON.parse(event.data);
              if (msg.type === "peer_connected") {
                toast.info("Windows Agent connected to session");
              } else if (msg.type === "peer_disconnected") {
                toast.warning("Windows Agent disconnected");
                setStatus("disconnected");
              } else if (msg.type === "pong" && typeof msg.t === "number") {
                // Phase 3: compute RTT from the echoed timestamp.
                const rtt = Date.now() - msg.t;
                setLatency(rtt);
                // Track RTT history for adaptive bitrate decisions.
                const hist = rttHistoryRef.current;
                hist.push(rtt);
                if (hist.length > 10) hist.shift();
                // Adjust bitrate every ~10s (5 pongs at 2s interval) based on avg RTT.
                if (hist.length >= 5) {
                  const avg = hist.reduce((a, b) => a + b, 0) / hist.length;
                  let target = currentBitrateRef.current;
                  if (avg > 400 && target > 500_000) {
                    target = Math.max(500_000, Math.round(target * 0.7));
                  } else if (avg < 120 && target < 3_000_000) {
                    target = Math.min(3_000_000, Math.round(target * 1.3));
                  }
                  if (target !== currentBitrateRef.current) {
                    currentBitrateRef.current = target;
                    wsRef.current.send(JSON.stringify({ type: "set_bitrate", bps: target }));
                  }
                }
              } else if (msg.type === "clipboard" && typeof msg.text === "string") {
                // Phase 3: agent pushed its clipboard → write to the viewer's clipboard.
                try {
                  if (navigator.clipboard?.writeText) {
                    navigator.clipboard.writeText(msg.text).catch(() => {});
                  }
                } catch {}
              } else if (msg.type === "webrtc_offer" && typeof msg.sdp === "string") {
                // Phase 3.5: agent sent a WebRTC offer — answer it and wire up the track.
                try {
                  const iceServers: RTCIceServer[] = [
                    { urls: "stun:stun.l.google.com:19302" },
                  ];
                  // Optional TURN (self-hosted coturn). Env:
                  // NEXT_PUBLIC_TURN_URL=turn:host:3478?transport=tcp + user/pass.
                  const turnUrl = process.env.NEXT_PUBLIC_TURN_URL as string | undefined;
                  if (turnUrl) {
                    iceServers.push({
                      urls: turnUrl,
                      username: (process.env.NEXT_PUBLIC_TURN_USER as string) || "ollalink",
                      credential: (process.env.NEXT_PUBLIC_TURN_PASS as string) || "ollalink-turn-secret",
                    });
                  }
                  const pc = new RTCPeerConnection({ iceServers });
                  pcRef.current = pc;
                  pc.ontrack = (ev) => {
                    // The agent's screen track arrived — switch the <video> to it.
                    if (videoRef.current && ev.streams[0]) {
                      videoRef.current.srcObject = ev.streams[0];
                      p2pActiveRef.current = true;
                      // Tell the agent P2P is live so it stops the MSE recorder.
                      if (wsRef.current?.readyState === WebSocket.OPEN) {
                        wsRef.current.send(JSON.stringify({ type: "webrtc_connected" }));
                      }
                      toast.success("P2P video connected (sub-100ms)");
                    }
                  };
                  pc.onicecandidate = (ev) => {
                    if (ev.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
                      wsRef.current.send(
                        JSON.stringify({ type: "webrtc_ice", candidate: ev.candidate.toJSON() })
                      );
                    }
                  };
                  pc.onconnectionstatechange = () => {
                    console.log("[Viewer] WebRTC state:", pc.connectionState);
                    if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
                      p2pActiveRef.current = false;
                      // MSE fallback is still running (if the agent is still sending chunks).
                      toast.warning("P2P dropped — falling back to relayed video");
                    }
                  };
                  await pc.setRemoteDescription({ type: "offer", sdp: msg.sdp });
                  const answer = await pc.createAnswer();
                  await pc.setLocalDescription(answer);
                  wsRef.current.send(JSON.stringify({ type: "webrtc_answer", sdp: answer.sdp }));
                } catch (err) {
                  console.error("[Viewer] WebRTC answer failed", err);
                  toast.error("P2P setup failed — using relayed video");
                }
              } else if (msg.type === "webrtc_ice" && msg.candidate) {
                // Phase 3.5: ICE candidate from the agent.
                try {
                  await pcRef.current?.addIceCandidate(msg.candidate);
                } catch (err) {
                  console.error("[Viewer] addIceCandidate failed", err);
                }
              }
            } catch (e) {
              console.error("Signal decode error", e);
            }
          } else if (event.data instanceof ArrayBuffer) {
            // Phase 3: append webm chunk to MSE SourceBuffer
            appendChunk(event.data);
          } else if (event.data instanceof Blob) {
            event.data.arrayBuffer().then(appendChunk);
          }
        };

        ws.onclose = () => {
          setStatus("disconnected");
          if (pingTimerRef.current) {
            clearInterval(pingTimerRef.current);
            pingTimerRef.current = null;
          }
        };

        ws.onerror = () => {
          toast.error("Relay connection error");
          setStatus("disconnected");
        };
      } catch (err) {
        toast.error("Failed to start remote session");
        setStatus("disconnected");
      }
    }

    init();

    return () => {
      if (wsRef.current) wsRef.current.close();
      if (pingTimerRef.current) {
        clearInterval(pingTimerRef.current);
        pingTimerRef.current = null;
      }
      // Phase 3.5: tear down the WebRTC peer connection.
      if (pcRef.current) {
        try { pcRef.current.close(); } catch {}
        pcRef.current = null;
      }
      p2pActiveRef.current = false;
      if (sessionId) endSession({ sessionId });
      // Clean up MSE
      const mse = mseRef.current;
      if (mse && mse.mediaSource.readyState === "open") {
        try { mse.mediaSource.endOfStream(); } catch {}
      }
      mseRef.current = null;
    };
  }, [device, deviceId]);

  // Handle user mouse movements & clicks on the remote video
  const handleMouseMove = (e: React.MouseEvent<HTMLVideoElement>) => {
    if (status !== "connected" || !wsRef.current || !videoRef.current) return;
    const rect = videoRef.current.getBoundingClientRect();
    const xPercent = (e.clientX - rect.left) / rect.width;
    const yPercent = (e.clientY - rect.top) / rect.height;

    wsRef.current.send(
      JSON.stringify({
        type: "mouse_move",
        x: xPercent,
        y: yPercent,
      })
    );
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLVideoElement>) => {
    if (status !== "connected" || !wsRef.current) return;
    wsRef.current.send(
      JSON.stringify({
        type: "mouse_click",
        button: e.button === 0 ? "left" : e.button === 2 ? "right" : "middle",
        down: true,
      })
    );
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLVideoElement>) => {
    if (status !== "connected" || !wsRef.current) return;
    wsRef.current.send(
      JSON.stringify({
        type: "mouse_click",
        button: e.button === 0 ? "left" : e.button === 2 ? "right" : "middle",
        down: false,
      })
    );
  };

  // Phase 3: Forward keyboard events to the agent
  const handleKeyDown = (e: React.KeyboardEvent<HTMLVideoElement>) => {
    if (status !== "connected" || !wsRef.current) return;
    e.preventDefault();
    wsRef.current.send(
      JSON.stringify({ type: "key", key: e.key, down: true })
    );
  };

  const handleKeyUp = (e: React.KeyboardEvent<HTMLVideoElement>) => {
    if (status !== "connected" || !wsRef.current) return;
    e.preventDefault();
    wsRef.current.send(
      JSON.stringify({ type: "key", key: e.key, down: false })
    );
  };

  const toggleFullscreen = () => {
    if (videoRef.current) {
      if (!document.fullscreenElement) {
        videoRef.current.requestFullscreen();
      } else {
        document.exitFullscreen();
      }
    }
  };

  // Phase 3: push the viewer's clipboard to the agent (manual button to avoid
  // silent permission prompts — reading the clipboard requires user gesture).
  const sendClipboard = async () => {
    if (status !== "connected" || !wsRef.current) return;
    try {
      const text = navigator.clipboard?.readText ? await navigator.clipboard.readText() : "";
      if (text) {
        wsRef.current.send(JSON.stringify({ type: "set_clipboard", text }));
        toast.success("Clipboard sent to remote");
      } else {
        toast.info("Your clipboard is empty");
      }
    } catch {
      toast.error("Could not read your clipboard (permission denied)");
    }
  };

  return (
    <div className="flex h-screen w-full flex-col bg-slate-950 text-white">
      {/* Control Top Bar */}
      <header className="flex h-14 items-center justify-between border-b border-slate-800 bg-slate-900 px-4">
        <div className="flex items-center gap-3">
          <Link href="/devices">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Monitor className="h-5 w-5 text-blue-400" />
            <h1 className="text-sm font-semibold">{device?.name || "Remote Windows Desktop"}</h1>
            <span
              className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                status === "connected"
                  ? "bg-green-500/10 text-green-400"
                  : status === "connecting"
                  ? "bg-yellow-500/10 text-yellow-400"
                  : "bg-red-500/10 text-red-400"
              }`}
            >
              {status}
            </span>
          </div>
        </div>

        {/* Streaming HUD Metrics */}
        <div className="flex items-center gap-6 text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <Wifi className="h-3.5 w-3.5 text-green-400" />
            <span>Latency: <strong className="text-slate-200">{latency}ms</strong></span>
          </div>
          <div className="flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5 text-blue-400" />
            <span>Framerate: <strong className="text-slate-200">{fps} FPS</strong></span>
          </div>
        </div>

        {/* Toolbar Actions */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={sendClipboard} className="gap-1.5 border-slate-700 bg-slate-800 hover:bg-slate-700">
            <Clipboard className="h-3.5 w-3.5" />
            Send clipboard
          </Button>
          <Button variant="outline" size="sm" onClick={toggleFullscreen} className="gap-1.5 border-slate-700 bg-slate-800 hover:bg-slate-700">
            <Maximize2 className="h-3.5 w-3.5" />
            Fullscreen
          </Button>
          <Link href="/devices">
            <Button variant="destructive" size="sm" className="gap-1.5">
              <Power className="h-3.5 w-3.5" />
              Disconnect
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Remote Canvas Screen */}
      <main className="relative flex flex-1 items-center justify-center bg-black overflow-hidden">
        {status === "connecting" && (
          <div className="flex flex-col items-center gap-3 text-slate-400">
            <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
            <p className="text-sm font-medium">Establishing video stream with Windows Agent...</p>
          </div>
        )}

        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          onContextMenu={(e) => e.preventDefault()}
          tabIndex={0}
          className={`max-h-full max-w-full object-contain cursor-crosshair border border-slate-800 ${
            status === "connected" ? "block" : "hidden"
          }`}
        />
      </main>
    </div>
  );
}
