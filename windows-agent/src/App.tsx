import { useState, useEffect, useRef } from 'react';
import { useMutation } from 'convex/react';
import './App.css';

const BACKOFF_STEPS = [5000, 10000, 20000, 40000, 60000]; // 5s → 10s → 20s → 40s → 60s cap
const MAX_CONSECUTIVE_FAILURES = 5;

function App() {
  const [pairingCode, setPairingCode] = useState('');
  const [deviceToken, setDeviceToken] = useState(localStorage.getItem('deviceToken') || '');
  const [status, setStatus] = useState(deviceToken ? 'Connecting...' : 'Waiting for pairing...');
  const [error, setError] = useState('');
  const [stats, setStats] = useState<any>(null);
  const [consecutiveFailures, setConsecutiveFailures] = useState(0);
  const [autoStartEnabled, setAutoStartEnabled] = useState(false);
  const [agentSessionId, setAgentSessionId] = useState<string | null>(null);
  // Performance monitoring: per-stage latency, bitrate, fps, connection state.
  const [perfStats, setPerfStats] = useState<{
    connectionState: string;
    p2pActive: boolean;
    videoCodec: string;
    bitrate: number;
    fps: number;
    captureMs: number;
    encodeMs: number;
    networkMs: number;
    totalBytesSent: number;
  }>({
    connectionState: 'idle',
    p2pActive: false,
    videoCodec: 'VP8',
    bitrate: 1_500_000,
    fps: 0,
    captureMs: 0,
    encodeMs: 0,
    networkMs: 0,
    totalBytesSent: 0,
  });

  // These state values are written for future UI use; reference them so noUnusedLocals passes.
  void consecutiveFailures;
  void autoStartEnabled;
  void agentSessionId;

  const pairAgent = useMutation('devices:pairAgent' as any);
  const agentHeartbeat = useMutation('devices:agentHeartbeat' as any);
  const agentOffline = useMutation('devices:agentOffline' as any);
  const pollAgentSession = useMutation('devices:pollAgentSession' as any);

  const tokenRef = useRef(deviceToken);
  tokenRef.current = deviceToken;
  const consecutiveFailuresRef = useRef(0);
  const currentAgentSessionRef = useRef<string | null>(null);
  const agentWsRef = useRef<WebSocket | null>(null);
  const agentFrameTimerRef = useRef<number | null>(null);
  const agentRecorderRef = useRef<MediaRecorder | null>(null);
  const clipboardTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastClipboardRef = useRef<string>('');
  // Phase 3.5: WebRTC P2P. The agent is the sender (it has the screen).
  // Signaling flows over the existing relay WS — no relay changes needed.
  // STUN-only (no TURN): ~80% P2P success; the rest fall back to MSE-over-WS.
  const agentPcRef = useRef<RTCPeerConnection | null>(null);
  const agentStreamRef = useRef<MediaStream | null>(null);
  const agentP2pActiveRef = useRef<boolean>(false);
  // Performance tracking refs.
  const bytesSentRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const lastFpsUpdateRef = useRef<number>(Date.now());

  const cleanupAgentSession = () => {
    if (agentWsRef.current) {
      agentWsRef.current.close();
      agentWsRef.current = null;
    }
    if (agentRecorderRef.current) {
      try {
        if (agentRecorderRef.current.state !== 'inactive') {
          agentRecorderRef.current.stop();
        }
      } catch {}
      agentRecorderRef.current = null;
    }
    if (agentFrameTimerRef.current) {
      window.clearTimeout(agentFrameTimerRef.current);
      agentFrameTimerRef.current = null;
    }
    if (clipboardTimerRef.current) {
      clearInterval(clipboardTimerRef.current);
      clipboardTimerRef.current = null;
    }
    // Phase 3.5: tear down the WebRTC peer connection.
    if (agentPcRef.current) {
      try { agentPcRef.current.close(); } catch {}
      agentPcRef.current = null;
    }
    agentStreamRef.current = null;
    agentP2pActiveRef.current = false;
    bytesSentRef.current = 0;
    frameCountRef.current = 0;
    lastClipboardRef.current = '';
    currentAgentSessionRef.current = null;
    setAgentSessionId(null);
    setPerfStats(prev => ({ ...prev, connectionState: 'idle', p2pActive: false, fps: 0, totalBytesSent: 0 }));
  };

  const connectAgentSession = async (sessionId: string) => {
    if (!sessionId || !window.electron) return;
    if (currentAgentSessionRef.current === sessionId) return;

    cleanupAgentSession();

    const relayUrl = import.meta.env.VITE_RELAY_URL || 'ws://localhost:8080';
    const ws = new WebSocket(`${relayUrl}?sessionId=${sessionId}&role=agent`);
    ws.binaryType = 'arraybuffer';

    ws.onopen = async () => {
      console.log('[Agent] Connected to Relay Server', sessionId);
      currentAgentSessionRef.current = sessionId;
      setAgentSessionId(sessionId);
      await startVideoStream(ws);
      // Phase 3.5: send the list of available monitors to the viewer so it can
      // show a monitor picker. The viewer sends back `select_monitor` with the
      // chosen source id to switch monitors mid-session.
      try {
        // @ts-ignore
        const sources = window.electron?.getScreenSources ? await window.electron.getScreenSources() : [];
        if (sources.length > 0 && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'monitors', sources }));
        }
      } catch (err) {
        console.error('[Agent] Failed to list monitors', err);
      }
      // Phase 3.5: attempt WebRTC P2P. The screen stream is captured once and
      // shared by both the MediaRecorder fallback and the RTCPeerConnection.
      // If P2P connects, the viewer tells us and we stop the MediaRecorder.
      try {
        await startWebRTC(ws);
      } catch (err) {
        console.error('[Agent] WebRTC setup failed — staying on MSE fallback', err);
      }
      // Phase 3: poll local clipboard every 1s and push changes to the viewer.
      if (clipboardTimerRef.current) clearInterval(clipboardTimerRef.current);
      lastClipboardRef.current = '';
      clipboardTimerRef.current = setInterval(async () => {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        try {
          // @ts-ignore
          const text = window.electron?.getClipboard ? await window.electron.getClipboard() : '';
          if (typeof text === 'string' && text && text !== lastClipboardRef.current) {
            lastClipboardRef.current = text;
            ws.send(JSON.stringify({ type: 'clipboard', text }));
          }
        } catch {}
      }, 1000);
    };

    ws.onmessage = async (event) => {
      if (typeof event.data === 'string') {
        try {
          const msg = JSON.parse(event.data);
          // Phase 3: echo viewer pings back as pong for RTT latency measurement.
          if (msg.type === 'ping' && typeof msg.t === 'number') {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'pong', t: msg.t }));
            }
            return;
          }
          // Phase 3: viewer requested a bitrate change (adaptive bitrate feedback).
          if (msg.type === 'set_bitrate' && typeof msg.bps === 'number') {
            const recorder = agentRecorderRef.current;
            if (recorder && recorder.state === 'recording') {
              try {
                // @ts-ignore — videoBitsPerSecond is a valid option on some browsers.
                recorder.videoBitsPerSecond = msg.bps;
                console.log('[Agent] Bitrate adjusted to', msg.bps);
              } catch (err) {
                console.error('[Agent] Bitrate adjust failed', err);
              }
            }
            return;
          }
          // Phase 3.5: viewer selected a different monitor — restart the video
          // stream with the new source id. Also tears down + rebuilds WebRTC.
          if (msg.type === 'select_monitor' && typeof msg.sourceId === 'string') {
            const ws = agentWsRef.current;
            if (!ws || ws.readyState !== WebSocket.OPEN) return;
            console.log('[Agent] Switching monitor to', msg.sourceId);
            // Stop the old recorder + WebRTC, keep the WS.
            if (agentRecorderRef.current) {
              try { if (agentRecorderRef.current.state !== 'inactive') agentRecorderRef.current.stop(); } catch {}
              agentRecorderRef.current = null;
            }
            if (agentPcRef.current) {
              try { agentPcRef.current.close(); } catch {}
              agentPcRef.current = null;
            }
            agentP2pActiveRef.current = false;
            // Start fresh with the selected source.
            await startVideoStream(ws, msg.sourceId);
            try { await startWebRTC(ws); } catch (err) {
              console.error('[Agent] WebRTC restart after monitor switch failed', err);
            }
            return;
          }
          // Phase 3: actually handle viewer input instead of just console.log
          if (msg.type === 'mouse_move' || msg.type === 'mouse_click' || msg.type === 'key') {
            try {
              // @ts-ignore
              await window.electron.injectInput(msg);
            } catch (err) {
              console.error('[Agent] Input inject failed', err);
            }
          }
          // Phase 3.5: WebRTC signaling — viewer answered our offer.
          if (msg.type === 'webrtc_answer' && typeof msg.sdp === 'string') {
            const pc = agentPcRef.current;
            if (pc) {
              try {
                await pc.setRemoteDescription({ type: 'answer', sdp: msg.sdp });
                console.log('[Agent] WebRTC remote description set');
              } catch (err) {
                console.error('[Agent] setRemoteDescription failed', err);
              }
            }
            return;
          }
          // Phase 3.5: WebRTC signaling — ICE candidate from viewer.
          if (msg.type === 'webrtc_ice' && msg.candidate) {
            const pc = agentPcRef.current;
            if (pc) {
              try {
                await pc.addIceCandidate(msg.candidate);
              } catch (err) {
                console.error('[Agent] addIceCandidate failed', err);
              }
            }
            return;
          }
          // Phase 3.5: viewer confirmed P2P track is playing — stop the
          // MediaRecorder fallback to save bandwidth.
          if (msg.type === 'webrtc_connected') {
            agentP2pActiveRef.current = true;
            setPerfStats(prev => ({ ...prev, p2pActive: true, connectionState: 'connected' }));
            const recorder = agentRecorderRef.current;
            if (recorder && recorder.state === 'recording') {
              try { recorder.stop(); } catch {}
              agentRecorderRef.current = null;
              console.log('[Agent] P2P active — stopped MSE fallback recorder');
            }
            return;
          }
          // Phase 3: viewer pushed its clipboard → write to Windows clipboard.
          if (msg.type === 'set_clipboard' && typeof msg.text === 'string') {
            try {
              // @ts-ignore
              await window.electron.setClipboard(msg.text);
              lastClipboardRef.current = msg.text; // avoid echoing it back
            } catch (err) {
              console.error('[Agent] setClipboard failed', err);
            }
          }
        } catch (e) {
          console.error('[Agent] Invalid viewer message', e);
        }
      }
    };

    ws.onclose = () => {
      console.log('[Agent] Relay disconnected', sessionId);
      cleanupAgentSession();
    };

    ws.onerror = (err) => {
      console.error('[Agent] Relay connection error', err);
      cleanupAgentSession();
    };

    agentWsRef.current = ws;
  };

  // Phase 3.5: Set up WebRTC P2P. The agent is the sender — it adds the screen
  // tracks to an RTCPeerConnection, creates an offer, and sends it over the relay
  // WS. ICE candidates are trickled over the same WS. STUN by default; TURN added
  // when VITE_TURN_URL is set (self-hosted coturn). If TURN is unset, symmetric-NAT
  // cases silently fall back to MSE-over-WS.
  const startWebRTC = async (ws: WebSocket) => {
    // @ts-ignore
    const stream: MediaStream = agentStreamRef.current || (await window.electron.getScreenStream());
    agentStreamRef.current = stream;

    const iceServers: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];
    // Optional TURN (self-hosted coturn). Env: VITE_TURN_URL=turn:host:3478?transport=tcp
    // + VITE_TURN_USER + VITE_TURN_PASS. If unset, STUN-only (MSE fallback covers the rest).
    const turnUrl = import.meta.env.VITE_TURN_URL as string | undefined;
    if (turnUrl) {
      iceServers.push({
        urls: turnUrl,
        username: import.meta.env.VITE_TURN_USER as string || 'ollalink',
        credential: import.meta.env.VITE_TURN_PASS as string || 'ollalink-turn-secret',
      });
    }

    const pc = new RTCPeerConnection({ iceServers });
    agentPcRef.current = pc;

    // Add screen tracks to the connection.
    for (const track of stream.getVideoTracks()) {
      pc.addTrack(track, stream);
    }

    // Trickle ICE candidates to the viewer over the relay WS.
    pc.onicecandidate = (e) => {
      if (e.candidate && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'webrtc_ice', candidate: e.candidate.toJSON() }));
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('[Agent] WebRTC state:', pc.connectionState);
      setPerfStats(prev => ({ ...prev, connectionState: pc.connectionState, p2pActive: agentP2pActiveRef.current }));
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        agentP2pActiveRef.current = false;
        setPerfStats(prev => ({ ...prev, p2pActive: false }));
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    ws.send(JSON.stringify({ type: 'webrtc_offer', sdp: offer.sdp }));
    console.log('[Agent] WebRTC offer sent');
  };

  // Phase 3: Real video capture via MediaRecorder.
  // Gets a MediaStream from the screen, records it as VP8 webm chunks,
  // and sends each chunk over the WebSocket as binary.
  // Phase 3.5: optional sourceId selects a specific monitor (multi-monitor).
  const startVideoStream = async (ws: WebSocket, sourceId?: string) => {
    try {
      // @ts-ignore
      const stream: MediaStream = await window.electron.getScreenStream(sourceId);
      agentStreamRef.current = stream;
      const recorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp8',
        videoBitsPerSecond: 1_500_000, // 1.5 Mbps — honest, adaptive later
      });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
          const sendStart = Date.now();
          ws.send(e.data);
          bytesSentRef.current += e.data.size;
          frameCountRef.current++;
          // Update FPS every second.
          const now = Date.now();
          if (now - lastFpsUpdateRef.current >= 1000) {
            const fps = frameCountRef.current;
            frameCountRef.current = 0;
            lastFpsUpdateRef.current = now;
            setPerfStats(prev => ({
              ...prev,
              fps,
              totalBytesSent: bytesSentRef.current,
              networkMs: Date.now() - sendStart,
            }));
          }
        }
      };

      // Start recording, request a chunk every 100ms (~10 chunks/sec).
      // Each chunk contains multiple frames; viewer reassembles via MSE.
      recorder.start(100);
      agentRecorderRef.current = recorder;
      console.log('[Agent] Video stream started', recorder.mimeType);
    } catch (err) {
      console.error('[Agent] Failed to start video stream', err);
      // Fallback: no video. Don't crash.
    }
  };

  // --- Send agentOffline on page unload (graceful shutdown) ---
  useEffect(() => {
    const handleUnload = () => {
      const token = localStorage.getItem('deviceToken');
      if (token) {
        // Fire-and-forget via sendBeacon-style: use the mutation synchronously if possible.
        // Convex mutations are async; we best-effort fire the offline mutation.
        try {
          agentOffline({ deviceToken: token });
        } catch {}
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [agentOffline]);

  // --- Load auto-start state on mount ---
  useEffect(() => {
    // @ts-ignore
    if (window.electron?.getAutoStartEnabled) {
      // @ts-ignore
      window.electron.getAutoStartEnabled().then((enabled: boolean) => setAutoStartEnabled(enabled));
    }
  }, []);

  // --- Step 2: Token validation on startup ---
  // On mount, if a token exists, immediately validate it with a heartbeat.
  // If the token is stale/revoked, clear it and return to pairing screen.
  useEffect(() => {
    const stored = localStorage.getItem('deviceToken');
    if (!stored) return;

    let cancelled = false;

    (async () => {
      try {
        // @ts-ignore
        const sysStats = window.electron ? await window.electron.getSystemStatsAsync() : null;
        const res = await agentHeartbeat({
          deviceToken: stored,
          ...(sysStats?.publicIp ? { ipAddress: sysStats.publicIp } : {}),
        }) as any;
        if (cancelled) return;
        consecutiveFailuresRef.current = 0;
        setConsecutiveFailures(0);
        setStatus(res.activeSessionId ? 'Streaming' : 'Connected');
        if (sysStats) setStats(sysStats);
        if (res.activeSessionId) {
          connectAgentSession(res.activeSessionId);
        }
      } catch (err: any) {
        if (cancelled) return;
        const msg = err?.message || '';
        if (msg.includes('Invalid device token')) {
          // Token is stale/revoked — clear and return to pairing
          localStorage.removeItem('deviceToken');
          setDeviceToken('');
          setStatus('Waiting for pairing...');
          setError('Previous session expired. Please re-pair.');
        } else {
          // Transient error — will retry via the heartbeat effect
          setStatus('Reconnecting...');
        }
      }
    })();

    return () => { cancelled = true; };
  }, []); // run once on mount

  // --- Step 3: Heartbeat with exponential backoff reconnection ---
  useEffect(() => {
    if (!deviceToken) return;

    let timer: ReturnType<typeof setTimeout>;
    let cancelled = false;

    const pollSession = async () => {
      if (cancelled || !tokenRef.current) return;
      try {
        const activeSessionId = await pollAgentSession({ deviceToken: tokenRef.current }) as any;
        if (cancelled) return;
        if (activeSessionId) {
          setStatus('Streaming');
          connectAgentSession(activeSessionId);
        }
      } catch {
        // ignore transient polling failures
      }
    };

    const beat = async () => {
      if (cancelled || !tokenRef.current) return;

      try {
        // @ts-ignore
        const sysStats = window.electron ? await window.electron.getSystemStatsAsync() : null;
        const res = await agentHeartbeat({
          deviceToken: tokenRef.current,
          ...(sysStats?.publicIp ? { ipAddress: sysStats.publicIp } : {}),
        }) as any;
        if (cancelled) return;
        consecutiveFailuresRef.current = 0;
        setConsecutiveFailures(0);
        setStatus(res.activeSessionId ? 'Streaming' : 'Connected');
        if (sysStats) setStats(sysStats);
        if (res.activeSessionId) {
          connectAgentSession(res.activeSessionId);
        }
        await pollSession();
        // Reset to baseline 30s on success
        timer = setTimeout(beat, 30000);
      } catch (err: any) {
        if (cancelled) return;
        const failures = consecutiveFailuresRef.current + 1;
        consecutiveFailuresRef.current = failures;
        setConsecutiveFailures(failures);

        if (failures >= MAX_CONSECUTIVE_FAILURES) {
          setStatus('Connection lost');
          setError('Lost connection to server. Click to re-pair.');
          return; // stop retrying — user must intervene
        }

        setStatus(`Reconnecting... (attempt ${failures})`);
        const delay = BACKOFF_STEPS[Math.min(failures - 1, BACKOFF_STEPS.length - 1)];
        timer = setTimeout(beat, delay);
      }
    };

    // Initial heartbeat (the startup-validation effect already fired one, but this
    // effect runs when deviceToken changes e.g. after pairing, so beat now).
    beat();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [deviceToken]); // NOTE: consecutiveFailures intentionally excluded to avoid re-trigger

  const doPairing = async (code: string, sysStats: any) => {
    setError('');
    setStatus('Pairing...');
    try {
      if (!sysStats) throw new Error("System stats not available yet");
      
      const res = await pairAgent({
        pairingCode: code,
        hostname: sysStats.hostname,
        os: `${sysStats.platform} ${sysStats.release}`,
        ...(sysStats.publicIp ? { ipAddress: sysStats.publicIp } : {}),
        agentVersion: '1.0.0',
      }) as any;
      
      setDeviceToken(res.deviceToken);
      localStorage.setItem('deviceToken', res.deviceToken);
      consecutiveFailuresRef.current = 0;
      setConsecutiveFailures(0);
      setStatus('Connected');
      if (res.activeSessionId) {
        setStatus('Streaming');
        connectAgentSession(res.activeSessionId);
      }
      // Enable auto-start after first successful pairing
      // @ts-ignore
      if (window.electron?.enableAutoStart) {
        // @ts-ignore
        window.electron.enableAutoStart().then(() => setAutoStartEnabled(true));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to pair');
      setStatus('Waiting for pairing...');
    }
  };

  // On first mount, collect system stats and auto-pair if CLI code is provided.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // @ts-ignore
      if (window.electron) {
        // @ts-ignore
        const sysStats = await window.electron.getSystemStatsAsync();
        if (cancelled) return;
        setStats(sysStats);
        // @ts-ignore
        const code = window.electron.getPairingCode();
        if (code && !localStorage.getItem('deviceToken')) {
          setPairingCode(code);
          await doPairing(code, sysStats);
        }
      } else {
        // Fallback for browser (non-Electron) environment
        const sysStats = {
          hostname: location.hostname || 'browser-agent',
          platform: navigator.platform || 'web',
          release: navigator.userAgent.match(/Windows NT [\d.]+|Mac OS X [\d._]+|Linux/)?.[0] || 'unknown',
          totalmem: 0,
          freemem: 0,
          cpus: [],
          uptime: 0,
          cpuUsage: 0,
          memUsage: 0,
          publicIp: '',
          localIp: '',
        };
        if (cancelled) return;
        setStats(sysStats);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handlePair = async (e: React.FormEvent) => {
    e.preventDefault();
    await doPairing(pairingCode, stats);
  };

  const handleDisconnect = () => {
    // Best-effort: notify server we're going offline
    const token = localStorage.getItem('deviceToken');
    if (token) {
      agentOffline({ deviceToken: token }).catch(() => {});
    }
    localStorage.removeItem('deviceToken');
    setDeviceToken('');
    setConsecutiveFailures(0);
    setStatus('Waiting for pairing...');
  };

  const handleRePair = () => {
    // Best-effort: notify server we're going offline
    const token = localStorage.getItem('deviceToken');
    if (token) {
      agentOffline({ deviceToken: token }).catch(() => {});
    }
    localStorage.removeItem('deviceToken');
    setDeviceToken('');
    setConsecutiveFailures(0);
    setError('');
    setStatus('Waiting for pairing...');
  };

  return (
    <div className="container">
      <div className="card">
        <h1 className="title">Ollalink Agent</h1>
        
        <div className="status-badge" data-status={deviceToken ? 'online' : 'offline'}>
          {status}
        </div>

        {!deviceToken ? (
          <form onSubmit={handlePair} className="form-group">
            <p className="instruction">Enter the 6-digit pairing code from your web dashboard.</p>
            <input 
              type="text" 
              placeholder="Pairing Code" 
              value={pairingCode}
              onChange={(e) => setPairingCode(e.target.value)}
              className="input-field"
              maxLength={6}
            />
            <button type="submit" className="btn-primary" disabled={pairingCode.length < 6}>
              Pair Device
            </button>
            {error && <p className="error-text">{error}</p>}
          </form>
        ) : status === 'Connection lost' ? (
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
            <div style={{ marginTop: '16px', padding: '12px', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', fontSize: '12px' }}>
              <div style={{ fontWeight: 600, marginBottom: '8px', opacity: 0.7 }}>Session Performance</div>
              <div className="stat-row">
                <span>Connection:</span>
                <strong>{perfStats.connectionState} {perfStats.p2pActive ? '(P2P)' : '(Relay)'}</strong>
              </div>
              <div className="stat-row">
                <span>Codec:</span>
                <strong>{perfStats.videoCodec}</strong>
              </div>
              <div className="stat-row">
                <span>Bitrate:</span>
                <strong>{(perfStats.bitrate / 1_000_000).toFixed(1)} Mbps</strong>
              </div>
              <div className="stat-row">
                <span>FPS:</span>
                <strong>{perfStats.fps}</strong>
              </div>
              <div className="stat-row">
                <span>Network RTT:</span>
                <strong>{perfStats.networkMs}ms</strong>
              </div>
              <div className="stat-row">
                <span>Data sent:</span>
                <strong>{(perfStats.totalBytesSent / 1_048_576).toFixed(1)} MB</strong>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
