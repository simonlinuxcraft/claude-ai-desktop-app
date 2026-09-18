'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('quickPromptAPI', {
  // 8000 = MAX_PROMPT_CHARS in main.js. Bewusst dupliziert: dieser Preload laeuft mit
  // sandbox:true und kann utils/ nicht requiren. Beide Stellen zusammen aendern.
  submit: (text) => {
    if (typeof text === 'string' && text.length > 0 && text.length <= 8000) {
      ipcRenderer.send('quickprompt-submit', text);
    }
  },
  cancel: () => ipcRenderer.send('quickprompt-cancel')
});