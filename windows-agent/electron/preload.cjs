const { contextBridge, ipcRenderer } = require('electron');
const os = require('os');

// Compute CPU usage percentage from two os.cpus() samples taken ~1s apart.
// Returns a Promise<number> 0..100. Falls back to 0 if sampling fails.
async function computeCpuUsage() {
  try {
    const sample = (cpus) => {
      let idle = 0, total = 0;
      for (const c of cpus) {
        const t = c.times;
        idle += t.idle;
        total += t.user + t.nice + t.sys + t.irq + t.idle;
      }
      return { idle, total };
    };
    const s1 = sample(os.cpus());
    await new Promise((r) => setTimeout(r, 1000));
    const s2 = sample(os.cpus());
    const idleDelta = s2.idle - s1.idle;
    const totalDelta = s2.total - s1.total;
    if (totalDelta === 0) return 0;
    return Math.round((1 - idleDelta / totalDelta) * 100);
  } catch {
    return 0;
  }
}

// Fetch public IP from ipify. Returns '' on failure.
async function getPublicIp() {
  try {
    const res = await fetch('https://api.ipify.org?format=json');
    const data = await res.json();
    return data.ip || '';
  } catch {
    return '';
  }
}

// Get first non-internal IPv4 address.
function getLocalIp() {
  try {
    const ifaces = os.networkInterfaces();
    for (const name of Object.keys(ifaces)) {
      for (const iface of ifaces[name] || []) {
        if (iface.family === 'IPv4' && !iface.internal) {
          return iface.address;
        }
      }
    }
  } catch {}
  return '';
}

contextBridge.exposeInMainWorld('electron', {
  getSystemStats: () => {
    return {
      hostname: os.hostname(),
      platform: os.platform(),
      release: os.release(),
      totalmem: os.totalmem(),
      freemem: os.freemem(),
      cpus: os.cpus(),
      uptime: os.uptime(),
      localIp: getLocalIp(),
    };
  },
  // Async stats including CPU% (requires 1s sampling) and public IP (network fetch).
  getSystemStatsAsync: async () => {
    const [cpuUsage, publicIp] = await Promise.all([
      computeCpuUsage(),
      getPublicIp(),
    ]);
    const totalmem = os.totalmem();
    const freemem = os.freemem();
    return {
      hostname: os.hostname(),
      platform: os.platform(),
      release: os.release(),
      totalmem,
      freemem,
      memUsage: totalmem > 0 ? Math.round(((totalmem - freemem) / totalmem) * 100) : 0,
      cpuUsage,
      uptime: os.uptime(),
      localIp: getLocalIp(),
      publicIp,
    };
  },
  getPairingCode: () => {
    const args = process.argv;
    const pairingCodeArgIndex = args.findIndex(arg => arg.toLowerCase() === '-pairingcode' || arg.toLowerCase() === '--pairing-code');
    if (pairingCodeArgIndex !== -1 && args.length > pairingCodeArgIndex + 1) {
      return args[pairingCodeArgIndex + 1];
    }
    return null;
  },
  // Auto-start management (registry Run key via Electron API)
  enableAutoStart: () => ipcRenderer.invoke('autostart:enable'),
  disableAutoStart: () => ipcRenderer.invoke('autostart:disable'),
  getAutoStartEnabled: () => ipcRenderer.invoke('autostart:get'),
});
