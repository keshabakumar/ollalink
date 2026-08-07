const { contextBridge, ipcRenderer } = require('electron');
const os = require('os');

// Native input helpers (moved to file scope so they can be used by the exposed API)
// Phase 3.5: Native input addon — calls Win32 SendInput directly (<1ms/event).
// Loaded lazily; if the native binary is missing or fails to load, we fall back
// to a long-running PowerShell process, and finally to a per-event exec.
let nativeInputAddon = null;
let nativeInputTried = false;
function loadNativeInput() {
  if (nativeInputTried) return nativeInputAddon;
  nativeInputTried = true;
  try {
    const path = require('path');
    const addonPath = path.join(__dirname, '..', 'native', 'input-addon');
    nativeInputAddon = require(addonPath);
    console.log('[Input] Native addon loaded — <1ms/event path active');
  } catch (err) {
    console.log('[Input] Native addon unavailable, will use PowerShell fallback');
    nativeInputAddon = null;
  }
  return nativeInputAddon;
}

// Long-running PowerShell injector script and process management.
const INPUT_PS_SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'
Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public class I{[DllImport(\"user32.dll\")]public static extern uint SendInput(uint n,INPUT[] i,int s);[StructLayout(LayoutKind.Explicit)]public struct INPUT{[FieldOffset(0)]public int type;[FieldOffset(8)]public MOUSEINPUT mi;[FieldOffset(8)]public KEYBDINPUT ki;}[StructLayout(LayoutKind.Sequential)]public struct MOUSEINPUT{public int dx;public int dy;public uint mouseData;public uint flags;public uint time;public IntPtr extra;}[StructLayout(LayoutKind.Sequential)]public struct KEYBDINPUT{public ushort wVk;public ushort scan;public uint flags;public uint time;public IntPtr extra;}}'
$mi = New-Object I+MOUSEINPUT
$ki = New-Object I+KEYBDINPUT
$miInput = New-Object I+INPUT
$kiInput = New-Object I+INPUT
$miInput.type = 0
$kiInput.type = 1
while ($line = [Console]::In.ReadLine()) {
  if (-not $line) { continue }
  $parts = $line -split ' '
  switch ($parts[0]) {
    'M' {
      $mi.dx = [int]$parts[1]
      $mi.dy = [int]$parts[2]
      $mi.flags = [uint32]$parts[3]
      $miInput.mi = $mi
      [I]::SendInput(1, @($miInput), 40) | Out-Null
    }
    'K' {
      $ki.wVk = [uint16]$parts[1]
      $ki.flags = [uint32]$parts[2]
      $kiInput.ki = $ki
      [I]::SendInput(1, @($kiInput), 40) | Out-Null
    }
    'W' {
      # Mouse wheel: $parts[1]=dx $parts[2]=dy $parts[3]=delta (WHEEL_DELTA=120)
      $mi.dx = 0
      $mi.dy = 0
      $mi.flags = 0x0800 # MOUSEEVENTF_WHEEL
      $mi.mouseData = [uint32]$parts[3]
      $miInput.mi = $mi
      [I]::SendInput(1, @($miInput), 40) | Out-Null
    }
  }
}
`;

let inputProc = null;
let inputProcStarting = false;
function getInputProc() {
  if (inputProc && !inputProc.killed && inputProc.stdin && !inputProc.stdin.destroyed) return inputProc;
  if (inputProcStarting) return null;
  inputProcStarting = true;
  try {
    const { spawn } = require('child_process');
    inputProc = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-NoLogo', '-Command', INPUT_PS_SCRIPT], { windowsHide: true });
    inputProc.stdin.setEncoding('utf8');
    inputProc.on('exit', () => { inputProc = null; });
    inputProc.on('error', (err) => { console.error('[Input] long-running PS error', err.message); inputProc = null; });
    // Drain stderr so it can't block the pipe.
    if (inputProc.stderr) inputProc.stderr.on('data', () => {});
  } catch (err) {
    console.error('[Input] failed to spawn long-running PS', err);
    inputProc = null;
  }
  inputProcStarting = false;
  return inputProc;
}

const VK_MAP = {
  Enter: 0x0d, Backspace: 0x08, Tab: 0x09, Escape: 0x1b,
  Shift: 0x10, Control: 0x11, Alt: 0x12, Space: 0x20,
  ArrowLeft: 0x25, ArrowUp: 0x26, ArrowRight: 0x27, ArrowDown: 0x28,
  Delete: 0x2e,
};

function injectInputLegacy(event) {
  try {
    const { exec } = require('child_process');
    const ps = buildInputPs(event);
    if (!ps) return;
    exec(ps, { windowsHide: true }, (err) => { if (err) console.error('[Input] Inject failed', err.message); });
  } catch (err) {
    console.error('[Input] injectInput error', err);
  }
}

function injectInputFast(event) {
  const addon = loadNativeInput();
  if (addon) {
    try {
      const { type, x, y, button, down, key } = event;
      if (type === 'mouse_move') {
        if (x == null || y == null) return;
        const ax = Math.round(x * 65535);
        const ay = Math.round(y * 65535);
        addon.injectMouse(ax, ay, 0x8001);
        return;
      }
      if (type === 'mouse_click') {
        let flag;
        if (button === 'right') flag = down ? 0x0008 : 0x0010;
        else if (button === 'middle') flag = down ? 0x0020 : 0x0040;
        else flag = down ? 0x0002 : 0x0004;
        addon.injectMouse(0, 0, flag);
        return;
      }
      if (type === 'key') {
        let vk = VK_MAP[key];
        if (vk == null && key && key.length === 1) vk = key.toUpperCase().charCodeAt(0);
        if (vk == null) return;
        const flags = down ? 0 : 0x0002;
        addon.injectKey(vk, flags);
        return;
      }
      // Wheel/scroll — send a mouse wheel event via the native addon.
      // The addon exposes injectWheel(deltaX, deltaY) if available.
      if (type === 'wheel' || type === 'scroll') {
        const dx = Math.round(event.deltaX || 0);
        const dy = Math.round(event.deltaY || event.wheelDelta || 0);
        if (dx === 0 && dy === 0) return;
        try {
          if (addon.injectWheel) {
            addon.injectWheel(dx, dy);
          } else {
            // Fallback: SendInput mouse wheel (WHEEL_DELTA = 120)
            addon.injectMouse(dx, dy, 0x0800); // MOUSEEVENTF_WHEEL
          }
        } catch (err) {
          console.error('[Input] wheel inject failed:', err.message);
        }
        return;
      }
      return;
    } catch (err) {
      console.error('[Input] native inject failed, falling back to PowerShell:', err.message);
    }
  }
  const proc = getInputProc();
  if (!proc || !proc.stdin || proc.stdin.destroyed) { injectInputLegacy(event); return; }
  const { type, x, y, button, down, key } = event;
  let line = null;
  if (type === 'mouse_move') {
    if (x == null || y == null) return;
    const ax = Math.round(x * 65535);
    const ay = Math.round(y * 65535);
    line = `M ${ax} ${ay} 32769`;
  } else if (type === 'mouse_click') {
    let flag;
    if (button === 'right') flag = down ? 0x0008 : 0x0010;
    else if (button === 'middle') flag = down ? 0x0020 : 0x0040;
    else flag = down ? 0x0002 : 0x0004;
    line = `M 0 0 ${flag}`;
  } else if (type === 'key') {
    let vk = VK_MAP[key];
    if (vk == null && key && key.length === 1) vk = key.toUpperCase().charCodeAt(0);
    if (vk == null) return;
    const flags = down ? 0 : 0x0002;
    line = `K ${vk} ${flags}`;
  } else if (type === 'wheel' || type === 'scroll') {
    // Mouse wheel via SendInput. WHEEL_DELTA = 120.
    const dx = Math.round(event.deltaX || 0);
    const dy = Math.round(event.deltaY || event.wheelDelta || 0);
    if (dx === 0 && dy === 0) return;
    // Encode as a wheel event: W 0 0 <delta> (we only support vertical wheel via PS)
    line = `W 0 0 ${dy}`;
  }
  if (line) {
    try {
      proc.stdin.write(line + '\n');
    } catch (err) {
      console.error('[Input] stdin write failed, falling back', err.message);
      injectInputLegacy(event);
    }
  }
}

// Legacy per-event PowerShell builder used only as last-resort fallback.
function buildInputPs(event) {
  const { type, x, y, button, down, key } = event || {};
  if (type === 'mouse_move') {
    if (x == null || y == null) return null;
    const ax = Math.round(x * 65535);
    const ay = Math.round(y * 65535);
    return `powershell -NoProfile -Command "Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public class I{[DllImport(\\"user32.dll\\")]public static extern uint SendInput(uint n,INPUT[] i,int s);[StructLayout(LayoutKind.Explicit)]public struct INPUT{[FieldOffset(0)]public int type;[FieldOffset(8)]public MOUSEINPUT mi;}[StructLayout(LayoutKind.Sequential)]public struct MOUSEINPUT{public int dx;public int dy;public uint flags;public uint time;public IntPtr extra;}}'; $i=New-Object I+INPUT;$i.type=0;$i.mi.dx=${ax};$i.mi.dy=${ay};$i.mi.flags=0x8001;[I]::SendInput(1,@($i),40)"`;
  }
  if (type === 'mouse_click') {
    let flag;
    if (button === 'right') flag = down ? 0x0008 : 0x0010;
    else if (button === 'middle') flag = down ? 0x0020 : 0x0040;
    else flag = down ? 0x0002 : 0x0004;
    return `powershell -NoProfile -Command "Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public class I{[DllImport(\\"user32.dll\\")]public static extern uint SendInput(uint n,INPUT[] i,int s);[StructLayout(LayoutKind.Explicit)]public struct INPUT{[FieldOffset(0)]public int type;[FieldOffset(8)]public MOUSEINPUT mi;}[StructLayout(LayoutKind.Sequential)]public struct MOUSEINPUT{public int dx;public int dy;public uint flags;public uint time;public IntPtr extra;}}'; $i=New-Object I+INPUT;$i.type=0;$i.mi.flags=${flag};[I]::SendInput(1,@($i),40)"`;
  }
  if (type === 'key') {
    let vk = VK_MAP[key];
    if (vk == null && key && key.length === 1) vk = key.toUpperCase().charCodeAt(0);
    if (vk == null) return null;
    const flags = down ? 0 : 0x0002;
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
  // Phase 3.5: optional sourceId lets the viewer pick a specific monitor.
  getScreenStream: async (sourceId) => {
    try {
      // If no sourceId given, pick the primary screen (first source).
      let id = sourceId;
      if (!id) {
        const { desktopCapturer } = require('electron');
        const sources = await desktopCapturer.getSources({
          types: ['screen'],
          thumbnailSize: { width: 0, height: 0 },
        });
        if (!sources.length) throw new Error('No screen source available');
        id = sources[0].id;
      }

      // getUserMedia with chromeMediaSource is the Electron-only way to capture a screen.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: id,
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

  // Input injection: native addon -> long-running PowerShell -> legacy exec.
  injectInput: async (event) => {
    injectInputFast(event);
  },

  // Phase 3.5: List all available screen sources (multi-monitor).
  // Returns [{ id, name, display_id, width, height }] for each monitor.
  // The viewer uses this to show a monitor picker; the chosen id is passed
  // back to getScreenStream(id) and startVideoStream(ws, sourceId).
  getScreenSources: async () => {
    try {
      const { desktopCapturer } = require('electron');
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 320, height: 180 }, // small thumbnails for the picker
        fetchWindowIcons: false,
      });
      return sources.map((s) => ({
        id: s.id,
        name: s.name,
        display_id: s.display_id,
        // thumbnail as a data URL so the viewer can preview each monitor
        thumbnail: s.thumbnail.toDataURL(),
      }));
    } catch (err) {
      console.error('[Capture] Failed to list screen sources', err);
      return [];
    }
  },

  // Session recording: save webm chunks to a temp file. The agent calls
  // startRecording() to create the file, appendRecordingChunk(data) for each
  // chunk, and stopRecording() to finalize + return the file path.
  // The viewer can then download the recording via a file:// URL or a
  // saveFile dialog.
  _recordingFilePath: null,
  _recordingStream: null,
  startRecording: async () => {
    try {
      const { app } = require('electron');
      const fs = require('fs');
      const path = require('path');
      const tempDir = app.getPath('temp');
      const fileName = `ollalink-session-${Date.now()}.webm`;
      const filePath = path.join(tempDir, fileName);
      const stream = fs.createWriteStream(filePath);
      // Write the webm header — MediaRecorder produces valid webm from the
      // first chunk, so we just append all chunks in order.
      return { filePath, stream };
    } catch (err) {
      console.error('[Recording] Failed to start recording', err);
      return null;
    }
  },
  appendRecordingChunk: async (stream, data) => {
    try {
      if (stream && !stream.destroyed) {
        stream.write(Buffer.from(data));
      }
    } catch (err) {
      console.error('[Recording] Failed to append chunk', err);
    }
  },
  stopRecording: async (stream, filePath) => {
    try {
      if (stream && !stream.destroyed) {
        await new Promise((resolve) => stream.end(resolve));
      }
      return filePath;
    } catch (err) {
      console.error('[Recording] Failed to stop recording', err);
      return null;
    }
  },
  showSaveDialog: async (suggestedName) => {
    try {
      const { dialog } = require('electron');
      const result = await dialog.showSaveDialog({
        title: 'Save Session Recording',
        defaultPath: suggestedName || 'ollalink-session.webm',
        filters: [{ name: 'WebM Video', extensions: ['webm'] }],
      });
      return result;
    } catch (err) {
      console.error('[Recording] Save dialog failed', err);
      return null;
    }
  },
  copyFile: async (src, dest) => {
    try {
      const fs = require('fs');
      fs.copyFileSync(src, dest);
      return true;
    } catch (err) {
      console.error('[Recording] Copy file failed', err);
      return false;
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
