const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain } = require('electron');
const path = require('path');
const isDev = !app.isPackaged;

let tray = null;
let mainWindow = null;
let startMinimized = false;

// --- Auto-start management (registry Run key via Electron API, no admin needed) ---
function getAutoStartEnabled() {
  try {
    return app.getLoginItemSettings().openAtLogin;
  } catch {
    return false;
  }
}

function setAutoStartEnabled(enabled) {
  try {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      args: ['--minimized'], // start silently in tray when auto-starting
    });
  } catch (err) {
    console.error('[AutoStart] Failed to set login item:', err);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false, // Don't show until ready-to-show (or never if --minimized)
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('ready-to-show', () => {
    // Only show the window if we weren't launched minimized (auto-start)
    if (!startMinimized) {
      mainWindow.show();
    }
  });

  // Prevent closing the app entirely when window is closed, hide instead
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
    return false;
  });
}

function buildTrayMenu() {
  const autoStart = getAutoStartEnabled();
  return Menu.buildFromTemplate([
    { label: 'Open Dashboard', click: () => { mainWindow.show(); } },
    { type: 'separator' },
    {
      label: 'Start with Windows',
      type: 'checkbox',
      checked: autoStart,
      click: (menuItem) => setAutoStartEnabled(menuItem.checked),
    },
    { type: 'separator' },
    { label: 'Quit', click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);
}

function createTray() {
  // 1x1 transparent png placeholder (replace with real icon in Phase 2 polish)
  const trayIconBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
  const icon = nativeImage.createFromDataURL(`data:image/png;base64,${trayIconBase64}`);
  
  tray = new Tray(icon);
  tray.setToolTip('Ollalink Agent');
  tray.setContextMenu(buildTrayMenu());

  tray.on('click', () => {
    mainWindow.show();
  });
}

// IPC: allow renderer to enable auto-start after successful pairing
ipcMain.handle('autostart:enable', () => {
  setAutoStartEnabled(true);
  if (tray) tray.setContextMenu(buildTrayMenu());
});
ipcMain.handle('autostart:disable', () => {
  setAutoStartEnabled(false);
  if (tray) tray.setContextMenu(buildTrayMenu());
});
ipcMain.handle('autostart:get', () => getAutoStartEnabled());

app.whenReady().then(() => {
  // Check for --minimized flag (set by auto-start registry entry)
  startMinimized = process.argv.includes('--minimized');

  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      mainWindow.show();
    }
  });
});

app.on('before-quit', () => {
  app.isQuitting = true;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
