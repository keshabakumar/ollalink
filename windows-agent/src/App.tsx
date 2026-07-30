import { useState, useEffect } from 'react';
import { useMutation } from 'convex/react';
import './App.css';

function App() {
  const [pairingCode, setPairingCode] = useState('');
  const [deviceToken, setDeviceToken] = useState(localStorage.getItem('deviceToken') || '');
  const [status, setStatus] = useState(deviceToken ? 'Connected' : 'Waiting for pairing...');
  const [error, setError] = useState('');
  const [stats, setStats] = useState<any>(null);

  const pairAgent = useMutation('devices:pairAgent' as any);
  const agentHeartbeat = useMutation('devices:agentHeartbeat' as any);

  useEffect(() => {
    // @ts-ignore
    if (window.electron) {
      // @ts-ignore
      setStats(window.electron.getSystemStats());
    } else {
      // Fallback for browser (non-Electron) environment
      setStats({
        hostname: location.hostname || 'browser-agent',
        platform: navigator.platform || 'web',
        release: navigator.userAgent.match(/Windows NT [\d.]+|Mac OS X [\d._]+|Linux/)?.[0] || 'unknown',
        totalmem: 0,
        freemem: 0,
        cpus: [],
        uptime: 0,
      });
    }
  }, []);

  useEffect(() => {
    if (!deviceToken) return;
    
    // Heartbeat every 30 seconds
    const interval = setInterval(async () => {
      try {
        await agentHeartbeat({ deviceToken });
        setStatus('Connected (Heartbeat OK)');
      } catch (err: any) {
        setStatus(`Error: ${err.message}`);
      }
    }, 30000);
    
    // Initial heartbeat
    agentHeartbeat({ deviceToken }).catch(console.error);

    return () => clearInterval(interval);
  }, [deviceToken]);

  const handlePair = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setStatus('Pairing...');
    try {
      if (!stats) throw new Error("System stats not available yet");
      
      const res = await pairAgent({
        pairingCode,
        hostname: stats.hostname,
        os: `${stats.platform} ${stats.release}`,
        agentVersion: '1.0.0',
      }) as any;
      
      setDeviceToken(res.deviceToken);
      localStorage.setItem('deviceToken', res.deviceToken);
      setStatus('Connected');
    } catch (err: any) {
      setError(err.message || 'Failed to pair');
      setStatus('Waiting for pairing...');
    }
  };

  const handleDisconnect = () => {
    localStorage.removeItem('deviceToken');
    setDeviceToken('');
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
