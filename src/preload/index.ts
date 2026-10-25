import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { PaintApi } from '../shared/types'

const api: PaintApi = {
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    toggleMaximize: () => ipcRenderer.invoke('window:toggle-maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
    getBounds: () => ipcRenderer.invoke('window:get-bounds'),
    setBounds: (bounds) => ipcRenderer.invoke('window:set-bounds', bounds),
    onMaximizeChange: (cb) => {
      const listener = (_e: Electron.IpcRendererEvent, value: boolean): void => cb(value)
      ipcRenderer.on('window:maximized-change', listener)
      return () => ipcRenderer.removeListener('window:maximized-change', listener)
    },
    onCloseRequested: (cb) => {
      const listener = (): void => cb()
      ipcRenderer.on('window:close-requested', listener)
      return () => ipcRenderer.removeListener('window:close-requested', listener)
    }
  },
  openImage: () => ipcRenderer.invoke('dialog:open-image'),
  saveImageDialog: (suggestedName, extension) => ipcRenderer.invoke('dialog:save-image', suggestedName, extension),
  readFile: (path) => ipcRenderer.invoke('fs:read', path),
  writeFile: (path, data) => ipcRenderer.invoke('fs:write', path, data),
  clipboardReadImage: () => ipcRenderer.invoke('clipboard:read-image'),
  clipboardWriteImage: (data) => ipcRenderer.invoke('clipboard:write-image', data),
  clipboardReadText: () => ipcRenderer.invoke('clipboard:read-text'),
  clipboardWriteText: (text) => ipcRenderer.invoke('clipboard:write-text', text),
  listFonts: () => ipcRenderer.invoke('fonts:list'),
  pathForFile: (file) => webUtils.getPathForFile(file),
  getVersion: () => ipcRenderer.invoke('app:version'),
  openPrint: (dataUrl) => ipcRenderer.invoke('print:image', dataUrl),
  onOpenFile: (cb) => {
    const listener = (_e: Electron.IpcRendererEvent, path: string): void => cb(path)
    ipcRenderer.on('app:open-file', listener)
    return () => ipcRenderer.removeListener('app:open-file', listener)
  }
}

contextBridge.exposeInMainWorld('paint', api)
