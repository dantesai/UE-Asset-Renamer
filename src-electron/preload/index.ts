import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  getFiles: (folderPath: string) => ipcRenderer.invoke('get-files', folderPath),
  renameFile: (oldPath: string, newPath: string) => ipcRenderer.invoke('rename-file', oldPath, newPath),
  batchRename: (operations: Array<{ oldPath: string; newPath: string }>) => ipcRenderer.invoke('batch-rename', operations)
})
