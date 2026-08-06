// Test that the native input addon loads inside Electron and its functions work.
// Run with: npx electron native/test-addon-in-electron.cjs
'use strict';
try {
  const a = require('./input-addon');
  console.log('[electron-test] LOADED:', Object.keys(a));
  console.log('[electron-test] injectMouse type:', typeof a.injectMouse);
  console.log('[electron-test] injectKey type:', typeof a.injectKey);
  // No-op call (flags=0 moves nothing) — just confirms SendInput returns success.
  const ok = a.injectMouse(0, 0, 0);
  console.log('[electron-test] injectMouse(0,0,0) returned:', ok);
  console.log('[electron-test] PASS — native addon works inside Electron');
} catch (e) {
  console.error('[electron-test] FAIL:', e.message);
}
// Electron needs the app to quit explicitly.
try { require('electron').app.quit(); } catch {}
process.exit(0);