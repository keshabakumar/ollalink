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
  type: "mouse_move" | "mouse_click" | "key" | "wheel" | "scroll";
  x?: number;
  y?: number;
  button?: "left" | "right" | "middle";
  down?: boolean;
  key?: string;
  deltaX?: number;
  deltaY?: number;
  wheelDelta?: number;
}

interface ScreenSource {
  id: string;
  name: string;
  display_id?: string;
  thumbnail?: string;
  width?: number;
  height?: number;
}

interface RecordingHandle {
  filePath: string;
  stream: any;
}

interface ElectronBridge {
  getSystemStats: () => SystemStats;
  getSystemStatsAsync: () => Promise<SystemStats>;
  getScreenStream: (sourceId?: string) => Promise<MediaStream>;
  getScreenSources: () => Promise<ScreenSource[]>;
  injectInput: (event: InputEvent) => Promise<void>;
  getPairingCode: () => string | null;
  enableAutoStart: () => Promise<void>;
  disableAutoStart: () => Promise<void>;
  getAutoStartEnabled: () => Promise<boolean>;
  setClipboard: (text: string) => Promise<void>;
  getClipboard: () => Promise<string>;
  startRecording: () => Promise<RecordingHandle | null>;
  appendRecordingChunk: (stream: any, data: ArrayBuffer) => Promise<void>;
  stopRecording: (stream: any, filePath: string) => Promise<string | null>;
  showSaveDialog: (suggestedName?: string) => Promise<any>;
  copyFile: (src: string, dest: string) => Promise<boolean>;
}

interface Window {
  electron?: ElectronBridge;
}