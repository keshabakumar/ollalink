const { contextBridge, ipcRenderer } = require('electron');
const os = require('os');

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
    };
  },
  getPairingCode: () => {
    const args = process.argv;
    const pairingCodeArgIndex = args.findIndex(arg => arg.toLowerCase() === '-pairingcode' || arg.toLowerCase() === '--pairing-code');
    if (pairingCodeArgIndex !== -1 && args.length > pairingCodeArgIndex + 1) {
      return args[pairingCodeArgIndex + 1];
    }
    return null;
  }
});
