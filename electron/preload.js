const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  invoke: (channel, payload) => ipcRenderer.invoke(channel, payload),
  on: (channel, callback) =>
    ipcRenderer.on(channel, (_, data) => callback(data))
});
