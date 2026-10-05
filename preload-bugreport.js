'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('bugAPI', {
  openSupport: () => ipcRenderer.send('bug-report-open-support'),
  resize: (h) => { if (Number.isFinite(h)) ipcRenderer.send('bug-report-resize', h); }
});
