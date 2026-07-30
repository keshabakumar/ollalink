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
  }
});
