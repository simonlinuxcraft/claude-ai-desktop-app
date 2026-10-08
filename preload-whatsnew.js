'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('whatsNewAPI', {
  close: () => ipcRenderer.send('whatsnew-close'),
  openSettings: () => ipcRenderer.send('whatsnew-open-settings'),
  openLink: (key) => ipcRenderer.send('whatsnew-open-link', key)
});