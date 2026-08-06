const { contextBridge, ipcRenderer } = require('electron');
const os = require('os');

// Phase 3: Build a PowerShell snippet that calls Win32 SendInput for one input event.
// This is an honest placeholder — it works but has ~30-50ms latency per event due to
// spawning a powershell.exe process each time. A native node addon (node-addon-api)
// would bring this to <1ms. We use it to prove the round-trip end-to-end.
function buildInputPs(event) {
  // SendInput signature: SendInput(cInputs, pInputs, cbSize)
  // MOUSEINPUT flags: MOUSEEVENTF_MOVE 0x0001, MOUSEEVENTF_LEFTDOWN 0x0002,
  // MOUSEEVENTF_LEFTUP 0x0004, MOUSEEVENTF_RIGHTDOWN 0x0008, MOUSEEVENTF_RIGHTUP 0x0010,
  // MOUSEEVENTF_ABSOLUTE 0x8000. Absolute coords are 0..65535 mapped to screen.
  const {
    type,
    x, y,            // normalized 0..1 from viewer
    button,          // 'left' | 'right' | 'middle'
    down,            // boolean
    key,             // for keyboard: character or key name
  } = event;

  if (type === 'mouse_move') {
    if (x == null || y == null) return null;
    const ax = Math.round(x * 65535);
    const ay = Math.round(y * 65535);
    return `powershell -NoProfile -Command "Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public class I{[DllImport(\\"user32.dll\\")]public static extern uint SendInput(uint n,INPUT[] i,int s);[StructLayout(LayoutKind.Explicit)]public struct INPUT{[FieldOffset(0)]public int type;[FieldOffset(8)]public MOUSEINPUT mi;}[StructLayout(LayoutKind.Sequential)]public struct MOUSEINPUT{public int dx;public int dy;public uint flags;public uint time;public IntPtr extra;}}'; $i=New-Object I+INPUT;$i.type=0;$i.mi.dx=${ax};$i.mi.dy=${ay};$i.mi.flags=0x8001;[I]::SendInput(1,@($i),40)"`;
  }

  if (type === 'mouse_click') {
    const flag = button === 'right'
      ? (down ? 0x0008 : 0x0010)
      : button === 'middle'
        ? (down ? 0x0020 : 0x0040)
        : (down ? 0x0002 : 0x0004);
    return `powershell -NoProfile -Command "Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public class I{[DllImport(\\"user32.dll\\")]public static extern uint SendInput(uint n,INPUT[] i,int s);[StructLayout(LayoutKind.Explicit)]public struct INPUT{[FieldOffset(0)]public int type;[FieldOffset(8)]public MOUSEINPUT mi;}[StructLayout(LayoutKind.Sequential)]public struct MOUSEINPUT{public int dx;public int dy;public uint flags;public uint time;public IntPtr extra;}}'; $i=New-Object I+INPUT;$i.type=0;$i.mi.flags=${flag};[I]::SendInput(1,@($i),40)"`;
  }

  if (type === 'key') {
    // Map a few common keys to VK codes. Honest: this is minimal.
    const vkMap = {
      Enter: 0x0d, Backspace: 0x08, Tab: 0x09, Escape: 0x1b,
      Shift: 0x10, Control: 0x11, Alt: 0x12, Space: 0x20,
      ArrowLeft: 0x25, ArrowUp: 0x26, ArrowRight: 0x27, ArrowDown: 0x28,
      Delete: 0x2e,
    };
    let vk = vkMap[key];
    if (vk == null && key && key.length === 1) {
      vk = key.toUpperCase().charCodeAt(0);
    }
    if (vk == null) return null;
    const flags = down ? 0 : 0x0002; // KEYEVENTF_KEYUP = 0x0002
    return `powershell -NoProfile -Command "Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public class I{[DllImport(\\"user32.dll\\")]public static extern uint SendInput(uint n,INPUT[] i,int s);[StructLayout(LayoutKind.Explicit)]public struct INPUT{[FieldOffset(0)]public int type;[FieldOffset(8)]public KEYBDINPUT ki;}[StructLayout(LayoutKind.Sequential)]public struct KEYBDINPUT{public ushort wVk;public ushort scan;public uint flags;public uint time;public IntPtr extra;}}'; $i=New-Object I+INPUT;$i.type=1;$i.ki.wVk=${vk};$i.ki.flags=${flags};[I]::SendInput(1,@($i),40)"`;
  }

  return null;
}

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
  // Phase 3: Real video capture.
  // Returns a MediaStream from the primary screen via desktopCapturer + getUserMedia.
  // The renderer creates a MediaRecorder on this stream and sends webm chunks over WS.
  getScreenStream: async () => {
    try {
      const { desktopCapturer } = require('electron');
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 0, height: 0 }, // we don't need thumbnails
      });
      if (!sources.length) throw new Error('No screen source available');
      const sourceId = sources[0].id;

      // getUserMedia with chromeMediaSource is the Electron-only way to capture a screen.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: sourceId,
            minWidth: 1280,
            maxWidth: 1920,
            minHeight: 720,
            maxHeight: 1080,
            minFrameRate: 15,
            maxFrameRate: 30,
          },
        },
      });
      return stream;
    } catch (err) {
      console.error('[Capture] Failed to get screen stream', err);
      throw err;
    }
  },

  // Phase 3: Inject mouse/keyboard input on the Windows host.
  // Uses PowerShell + Win32 SendInput via Add-Type. ~30-50ms per event — honest placeholder
  // for a native node addon. Good enough to prove the round-trip works.
  injectInput: async (event) => {
    try {
      const { exec } = require('child_process');
      const ps = buildInputPs(event);
      if (!ps) return;
      exec(ps, { windowsHide: true }, (err) => {
        if (err) console.error('[Input] Inject failed', err.message);
      });
    } catch (err) {
      console.error('[Input] injectInput error', err);
    }
  },

  // Phase 3: Clipboard sync — write text to the Windows clipboard via PowerShell.
  // Honest: spawns powershell.exe (~30-50ms), fine for occasional clipboard writes.
  setClipboard: async (text) => {
    try {
      const { exec } = require('child_process');
      // Escape single quotes for PowerShell single-quoted string.
      const safe = String(text).replace(/'/g, "''");
      const ps = `powershell -NoProfile -Command "Set-Clipboard -Value '${safe}'"`;
      exec(ps, { windowsHide: true }, (err) => {
        if (err) console.error('[Clipboard] set failed', err.message);
      });
    } catch (err) {
      console.error('[Clipboard] setClipboard error', err);
    }
  },

  // Phase 3: Clipboard sync — read text from the Windows clipboard via PowerShell.
  // Returns '' on failure. Used by the agent to push its clipboard to the viewer.
  getClipboard: async () => {
    try {
      const { exec } = require('child_process');
      return await new Promise((resolve) => {
        const ps = `powershell -NoProfile -Command "Get-Clipboard -Raw"`;
        exec(ps, { windowsHide: true, maxBuffer: 2 * 1024 * 1024 }, (err, stdout) => {
          if (err) {
            console.error('[Clipboard] get failed', err.message);
            resolve('');
          } else {
            // Get-Clipboard -Raw preserves newlines; trim only the trailing one PowerShell adds.
            resolve(stdout.replace(/\r?\n$/, ''));
          }
        });
      });
    } catch (err) {
      console.error('[Clipboard] getClipboard error', err);
      return '';
    }
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
