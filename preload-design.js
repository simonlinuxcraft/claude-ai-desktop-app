'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('designAPI', {
  setMode: (m) => { if (typeof m === 'string') ipcRenderer.send('design-set-mode', m); },
  setDesign: (s) => { if (typeof s === 'string') ipcRenderer.send('design-set-design', s); },
  setTrayMono: (on) => ipcRenderer.send('design-set-tray-mono', on === true),
  setMatrixRain: (on) => ipcRenderer.send('design-set-matrix-rain', on === true),
  close: () => ipcRenderer.send('design-close')
});