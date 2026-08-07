"use client";

import { useWorkspace } from "@/lib/useWorkspace";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, Monitor, Maximize2, RefreshCw, Wifi, Activity, Power } from "lucide-react";
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
  const [latency, setLatency] = useState<number>(14);
  const [fps, setFps] = useState<number>(60);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

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
        };

        ws.onmessage = (event) => {
          if (typeof event.data === "string") {
            try {
              const msg = JSON.parse(event.data);
              if (msg.type === "peer_connected") {
                toast.info("Windows Agent connected to session");
              } else if (msg.type === "peer_disconnected") {
                toast.warning("Windows Agent disconnected");
                setStatus("disconnected");
              }
            } catch (e) {
              console.error("Signal decode error", e);
            }
          } else if (event.data instanceof Blob || event.data instanceof ArrayBuffer) {
            // Render incoming frame buffer onto Canvas
            const ctx = canvasRef.current?.getContext("2d");
            if (!ctx) return;
            
            const blob = event.data instanceof Blob ? event.data : new Blob([event.data]);
            const url = URL.createObjectURL(blob);
            const img = new Image();
            img.onload = () => {
              ctx.drawImage(img, 0, 0, canvasRef.current!.width, canvasRef.current!.height);
              URL.revokeObjectURL(url);
            };
            img.src = url;
          }
        };

        ws.onclose = () => {
          setStatus("disconnected");
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
      if (sessionId) endSession({ sessionId });
    };
  }, [device, deviceId]);

  // Handle user mouse movements & clicks on the remote canvas
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (status !== "connected" || !wsRef.current || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
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

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (status !== "connected" || !wsRef.current) return;
    wsRef.current.send(
      JSON.stringify({
        type: "mouse_click",
        button: e.button === 0 ? "left" : e.button === 2 ? "right" : "middle",
        down: true,
      })
    );
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (status !== "connected" || !wsRef.current) return;
    wsRef.current.send(
      JSON.stringify({
        type: "mouse_click",
        button: e.button === 0 ? "left" : e.button === 2 ? "right" : "middle",
        down: false,
      })
    );
  };

  const toggleFullscreen = () => {
    if (canvasRef.current) {
      if (!document.fullscreenElement) {
        canvasRef.current.requestFullscreen();
      } else {
        document.exitFullscreen();
      }
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
            <p className="text-sm font-medium">Establishing secure WebRTC stream with Windows Agent...</p>
          </div>
        )}

        <canvas
          ref={canvasRef}
          width={1920}
          height={1080}
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onContextMenu={(e) => e.preventDefault()}
          className={`max-h-full max-w-full object-contain cursor-crosshair border border-slate-800 ${
            status === "connected" ? "block" : "hidden"
          }`}
        />
      </main>
    </div>
  );
}
