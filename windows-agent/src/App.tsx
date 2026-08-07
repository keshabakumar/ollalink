import { useState, useEffect, useRef, useCallback } from "react";
import { useMutation } from "convex/react";
import { AgentSession, type PerfStats } from "./lib/session";
import { InputHandler } from "./lib/input-handler";
import { formatStats } from "./lib/performance-tracker";
import "./App.css";

const BACKOFF_STEPS = [5000, 10000, 20000, 40000, 60000]; // 5s → 60s cap
const MAX_CONSECUTIVE_FAILURES = 5;

function App() {
  const [pairingCode, setPairingCode] = useState("");
  const [deviceToken, setDeviceToken] = useState(
    localStorage.getItem("deviceToken") || "",
  );
  const [status, setStatus] = useState(
    deviceToken ? "Connecting..." : "Waiting for pairing...",
  );
  const [error, setError] = useState("");
  const [stats, setStats] = useState<any>(null);
  const [consecutiveFailures, setConsecutiveFailures] = useState(0);
  const [autoStartEnabled, setAutoStartEnabled] = useState(false);
  const [perfStats, setPerfStats] = useState<PerfStats>({
    connectionState: "idle",
    mode: "none",
    videoCodec: "VP8",
    bitrate: 1_500_000,
    fps: 0,
    captureMs: 0,
    encodeMs: 0,
    networkMs: 0,
    totalBytesSent: 0,
  });

  const pairAgent = useMutation("devices:pairAgent" as any);
  const agentHeartbeat = useMutation("devices:agentHeartbeat" as any);
  const agentOffline = useMutation("devices:agentOffline" as any);
  const pollAgentSession = useMutation("devices:pollAgentSession" as any);

  // Single session instance for the app's lifetime.
  const sessionRef = useRef<AgentSession | null>(null);
  const inputHandlerRef = useRef<InputHandler | null>(null);
  const tokenRef = useRef(deviceToken);
  tokenRef.current = deviceToken;
  const consecutiveFailuresRef = useRef(0);

  // These state values are written for future UI use; reference them so noUnusedLocals passes.
  void consecutiveFailures;
  void autoStartEnabled;

  // --- Lazy-init the session + input handler once ---
  if (!sessionRef.current) {
    sessionRef.current = new AgentSession();
    inputHandlerRef.current = new InputHandler();
  }

  // Wire up state listeners for the session.
  useEffect(() => {
    const session = sessionRef.current!;
    const input = inputHandlerRef.current!;
    input.enable();

    const unsubState = session.onStateChange(({ stats }) => {
      setPerfStats({ ...stats });
    });
    const unsubMsg = session.onMessage((msg) => {
      // Delegate input events to the input handler.
      input.handle(msg);
    });

    return () => {
      unsubState();
      unsubMsg();
      session.disconnect();
    };
  }, []);

  const connectAgentSession = useCallback(async (sessionId: string) => {
    const session = sessionRef.current;
    if (!session) return;
    await session.connect(sessionId);
  }, []);

  // --- Send agentOffline on page unload (graceful shutdown) ---
  useEffect(() => {
    const handleUnload = () => {
      const token = localStorage.getItem("deviceToken");
      if (token) {
        try {
          agentOffline({ deviceToken: token });
        } catch {}
      }
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [agentOffline]);

  // --- Load auto-start state on mount ---
  useEffect(() => {
    const bridge = (window as any).electron;
    if (bridge?.getAutoStartEnabled) {
      bridge.getAutoStartEnabled().then((enabled: boolean) =>
        setAutoStartEnabled(enabled),
      );
    }
  }, []);

  // --- Step 2: Token validation on startup ---
  useEffect(() => {
    const stored = localStorage.getItem("deviceToken");
    if (!stored) return;

    let cancelled = false;
    (async () => {
      try {
        const bridge = (window as any).electron;
        const sysStats = bridge
          ? await bridge.getSystemStatsAsync()
          : null;
        const res = (await agentHeartbeat({
          deviceToken: stored,
          ...(sysStats?.publicIp ? { ipAddress: sysStats.publicIp } : {}),
        })) as any;
        if (cancelled) return;
        consecutiveFailuresRef.current = 0;
        setConsecutiveFailures(0);
        setStatus(res.activeSessionId ? "Streaming" : "Connected");
        if (sysStats) setStats(sysStats);
        if (res.activeSessionId) {
          connectAgentSession(res.activeSessionId);
        }
      } catch (err: any) {
        if (cancelled) return;
        const msg = err?.message || "";
        if (msg.includes("Invalid device token")) {
          localStorage.removeItem("deviceToken");
          setDeviceToken("");
          setStatus("Waiting for pairing...");
          setError("Previous session expired. Please re-pair.");
        } else {
          setStatus("Reconnecting...");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []); // run once on mount

  // --- Step 3: Heartbeat with exponential backoff reconnection ---
  useEffect(() => {
    if (!deviceToken) return;

    let timer: ReturnType<typeof setTimeout>;
    let cancelled = false;

    const pollSession = async () => {
      if (cancelled || !tokenRef.current) return;
      try {
        const activeSessionId = (await pollAgentSession({
          deviceToken: tokenRef.current,
        })) as any;
        if (cancelled) return;
        if (activeSessionId) {
          setStatus("Streaming");
          connectAgentSession(activeSessionId);
        }
      } catch {}
    };

    const beat = async () => {
      if (cancelled || !tokenRef.current) return;
      try {
        const bridge = (window as any).electron;
        const sysStats = bridge
          ? await bridge.getSystemStatsAsync()
          : null;
        const res = (await agentHeartbeat({
          deviceToken: tokenRef.current,
          ...(sysStats?.publicIp ? { ipAddress: sysStats.publicIp } : {}),
        })) as any;
        if (cancelled) return;
        consecutiveFailuresRef.current = 0;
        setConsecutiveFailures(0);
        setStatus(res.activeSessionId ? "Streaming" : "Connected");
        if (sysStats) setStats(sysStats);
        if (res.activeSessionId) {
          connectAgentSession(res.activeSessionId);
        }
        await pollSession();
        timer = setTimeout(beat, 30000); // reset to 30s on success
      } catch (err: any) {
        if (cancelled) return;
        const failures = consecutiveFailuresRef.current + 1;
        consecutiveFailuresRef.current = failures;
        setConsecutiveFailures(failures);

        if (failures >= MAX_CONSECUTIVE_FAILURES) {
          setStatus("Connection lost");
          setError("Lost connection to server. Click to re-pair.");
          return;
        }
        setStatus(`Reconnecting... (attempt ${failures})`);
        const delay = BACKOFF_STEPS[
          Math.min(failures - 1, BACKOFF_STEPS.length - 1)
        ];
        timer = setTimeout(beat, delay);
      }
    };

    beat();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [deviceToken]); // NOTE: consecutiveFailures intentionally excluded

  const doPairing = async (code: string, sysStats: any) => {
    setError("");
    setStatus("Pairing...");
    try {
      if (!sysStats) throw new Error("System stats not available yet");

      const res = (await pairAgent({
        pairingCode: code,
        hostname: sysStats.hostname,
        os: `${sysStats.platform} ${sysStats.release}`,
        ...(sysStats.publicIp ? { ipAddress: sysStats.publicIp } : {}),
        agentVersion: "1.0.0",
      })) as any;

      setDeviceToken(res.deviceToken);
      localStorage.setItem("deviceToken", res.deviceToken);
      consecutiveFailuresRef.current = 0;
      setConsecutiveFailures(0);
      setStatus("Connected");
      if (res.activeSessionId) {
        setStatus("Streaming");
        connectAgentSession(res.activeSessionId);
      }
      const bridge = (window as any).electron;
      if (bridge?.enableAutoStart) {
        bridge.enableAutoStart().then(() => setAutoStartEnabled(true));
      }
    } catch (err: any) {
      setError(err.message || "Failed to pair");
      setStatus("Waiting for pairing...");
    }
  };

  // On first mount, collect system stats and auto-pair if CLI code is provided.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const bridge = (window as any).electron;
      if (bridge) {
        const sysStats = await bridge.getSystemStatsAsync();
        if (cancelled) return;
        setStats(sysStats);
        const code = bridge.getPairingCode();
        if (code && !localStorage.getItem("deviceToken")) {
          setPairingCode(code);
          await doPairing(code, sysStats);
        }
      } else {
        // Fallback for browser (non-Electron) environment
        const sysStats = {
          hostname: location.hostname || "browser-agent",
          platform: navigator.platform || "web",
          release:
            navigator.userAgent.match(
              /Windows NT [\d.]+|Mac OS X [\d._]+|Linux/,
            )?.[0] || "unknown",
          totalmem: 0,
          freemem: 0,
          cpus: [],
          uptime: 0,
          cpuUsage: 0,
          memUsage: 0,
          publicIp: "",
          localIp: "",
        };
        if (cancelled) return;
        setStats(sysStats);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handlePair = async (e: React.FormEvent) => {
    e.preventDefault();
    await doPairing(pairingCode, stats);
  };

  const handleDisconnect = () => {
    const token = localStorage.getItem("deviceToken");
    if (token) {
      agentOffline({ deviceToken: token }).catch(() => {});
    }
    localStorage.removeItem("deviceToken");
    setDeviceToken("");
    setConsecutiveFailures(0);
    setStatus("Waiting for pairing...");
    sessionRef.current?.disconnect();
  };

  const handleRePair = () => {
    const token = localStorage.getItem("deviceToken");
    if (token) {
      agentOffline({ deviceToken: token }).catch(() => {});
    }
    localStorage.removeItem("deviceToken");
    setDeviceToken("");
    setConsecutiveFailures(0);
    setError("");
    setStatus("Waiting for pairing...");
    sessionRef.current?.disconnect();
  };

  const display = formatStats(perfStats);

  return (
    <div className="container">
      <div className="card">
        <h1 className="title">Ollalink Agent</h1>

        <div
          className="status-badge"
          data-status={deviceToken ? "online" : "offline"}
        >
          {status}
        </div>

        {!deviceToken ? (
          <form onSubmit={handlePair} className="form-group">
            <p className="instruction">
              Enter the 6-digit pairing code from your web dashboard.
            </p>
            <input
              type="text"
              placeholder="Pairing Code"
              value={pairingCode}
              onChange={(e) => setPairingCode(e.target.value)}
              className="input-field"
              maxLength={6}
            />
            <button
              type="submit"
              className="btn-primary"
              disabled={pairingCode.length < 6}
            >
              Pair Device
            </button>
            {error && <p className="error-text">{error}</p>}
          </form>
        ) : status === "Connection lost" ? (
          <div className="stats-container">
            <p className="error-text">{error}</p>
            <button onClick={handleRePair} className="btn-primary">
              Re-pair Device
            </button>
          </div>
        ) : (
          <div className="stats-container">
            <h3>System Info Syncing</h3>
            <div className="stat-row">
              <span>Hostname:</span>
              <strong>{stats?.hostname}</strong>
            </div>
            <div className="stat-row">
              <span>OS:</span>
              <strong>{stats?.platform} {stats?.release}</strong>
            </div>
            <div className="stat-row">
              <span>Uptime:</span>
              <strong>{stats ? Math.floor(stats.uptime / 3600) : 0} hours</strong>
            </div>
            {stats?.cpuUsage != null && (
              <div className="stat-row">
                <span>CPU:</span>
                <strong>{stats.cpuUsage}%</strong>
              </div>
            )}
            {stats?.memUsage != null && (
              <div className="stat-row">
                <span>Memory:</span>
                <strong>{stats.memUsage}%</strong>
              </div>
            )}
            {stats?.publicIp && (
              <div className="stat-row">
                <span>Public IP:</span>
                <strong>{stats.publicIp}</strong>
              </div>
            )}
            <button onClick={handleDisconnect} className="btn-secondary">
              Disconnect
            </button>
            {/* Performance monitoring panel */}
            <div
              style={{
                marginTop: "16px",
                padding: "12px",
                borderRadius: "8px",
                background: "rgba(0,0,0,0.2)",
                fontSize: "12px",
              }}
            >
              <div
                style={{
                  fontWeight: 600,
                  marginBottom: "8px",
                  opacity: 0.7,
                }}
              >
                Session Performance
              </div>
              <div className="stat-row">
                <span>Connection:</span>
                <strong>
                  {display.connectionLabel} ({display.modeLabel})
                </strong>
              </div>
              <div className="stat-row">
                <span>Codec:</span>
                <strong>{display.videoCodec}</strong>
              </div>
              <div className="stat-row">
                <span>Bitrate:</span>
                <strong>{display.bitrateMbps.toFixed(1)} Mbps</strong>
              </div>
              <div className="stat-row">
                <span>FPS:</span>
                <strong>{display.fps}</strong>
              </div>
              <div className="stat-row">
                <span>Network RTT:</span>
                <strong>{display.networkMs}ms</strong>
              </div>
              <div className="stat-row">
                <span>Data sent:</span>
                <strong>{display.totalBytesMB.toFixed(1)} MB</strong>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
