'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('whatsNewAPI', {
  close: () => ipcRenderer.send('whatsnew-close'),
  openLink: (key) => ipcRenderer.send('whatsnew-open-link', key)
});