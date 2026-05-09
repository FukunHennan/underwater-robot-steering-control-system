import { ipcRenderer, contextBridge } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  getSerialPorts: () => ipcRenderer.invoke('getSerialPorts'),
})