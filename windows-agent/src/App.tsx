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

  const pairAgent = useMutation('devices:pairAgent' as any);
  const agentHeartbeat = useMutation('devices:agentHeartbeat' as any);
  const agentOffline = useMutation('devices:agentOffline' as any);

  const tokenRef = useRef(deviceToken);
  tokenRef.current = deviceToken;

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
        });
        if (cancelled) return;
        setConsecutiveFailures(0);
        setStatus('Connected');
        if (sysStats) setStats(sysStats);
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

    const beat = async () => {
      if (cancelled || !tokenRef.current) return;

      try {
        // @ts-ignore
        const sysStats = window.electron ? await window.electron.getSystemStatsAsync() : null;
        await agentHeartbeat({
          deviceToken: tokenRef.current,
          ...(sysStats?.publicIp ? { ipAddress: sysStats.publicIp } : {}),
        });
        if (cancelled) return;
        setConsecutiveFailures(0);
        setStatus('Connected');
        if (sysStats) setStats(sysStats);
        // Reset to baseline 30s on success
        timer = setTimeout(beat, 30000);
      } catch (err: any) {
        if (cancelled) return;
        const failures = consecutiveFailures + 1;
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
      setConsecutiveFailures(0);
      setStatus('Connected');
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
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
