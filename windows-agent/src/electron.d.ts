// Type declarations for the Electron preload bridge exposed on window.electron
interface SystemStats {
  hostname: string;
  platform: string;
  release: string;
  totalmem: number;
  freemem: number;
  cpus: os.CpuInfo[];
  uptime: number;
  localIp: string;
  memUsage?: number;
  cpuUsage?: number;
  publicIp?: string;
}

interface InputEvent {
  type: "mouse_move" | "mouse_click" | "key";
  x?: number;
  y?: number;
  button?: "left" | "right" | "middle";
  down?: boolean;
  key?: string;
}

interface ElectronBridge {
  getSystemStats: () => SystemStats;
  getSystemStatsAsync: () => Promise<SystemStats>;
  getScreenStream: () => Promise<MediaStream>;
  injectInput: (event: InputEvent) => Promise<void>;
  captureScreenFrame?: () => Promise<ArrayBuffer>;
  getPairingCode: () => string | null;
  enableAutoStart: () => Promise<void>;
  disableAutoStart: () => Promise<void>;
  getAutoStartEnabled: () => Promise<boolean>;
}

interface Window {
  electron?: ElectronBridge;
}