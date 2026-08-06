// Loader: prefer the prebuilt binary, fall back to a build from source.
// In the Electron agent we require() this file; if the native binary is missing
// or fails to load, the preload falls back to the long-running PowerShell path.
'use strict';

let addon;
try {
  addon = require('node-gyp-build')(require('path').join(__dirname));
} catch (e1) {
  try {
    addon = require('./build/Release/input_addon.node');
  } catch (e2) {
    // Re-throw the original error so the caller can catch and fall back.
    throw e1;
  }
}

module.exports = addon;