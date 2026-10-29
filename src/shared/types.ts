export interface OpenFileResult {
  path: string
  name: string
  data: Uint8Array
}

export interface SaveAsResult {
  path: string
}

export interface FontList {
  families: string[]
}

export interface WindowApi {
  minimize: () => Promise<void>
  toggleMaximize: () => Promise<boolean>
  close: () => Promise<void>
  isMaximized: () => Promise<boolean>
  getBounds: () => Promise<{ x: number; y: number; width: number; height: number }>
  setBounds: (bounds: { x: number; y: number; width: number; height: number }) => Promise<void>
  onMaximizeChange: (cb: (maximized: boolean) => void) => () => void
  onCloseRequested: (cb: () => void) => () => void
}

export interface PaintApi {
  window: WindowApi
  openImage: () => Promise<OpenFileResult | null>
  saveImageDialog: (suggestedName: string, extension: string) => Promise<SaveAsResult | null>
  readFile: (path: string) => Promise<Uint8Array>
  writeFile: (path: string, data: Uint8Array) => Promise<void>
  clipboardReadImage: () => Promise<Uint8Array | null>
  clipboardWriteImage: (data: Uint8Array) => Promise<void>
  clipboardReadText: () => Promise<string>
  clipboardWriteText: (text: string) => Promise<void>
  listFonts: () => Promise<string[]>
  pathForFile: (file: File) => string
  getVersion: () => Promise<string>
  openPrint: (dataUrl: string) => Promise<void>
  showError: (message: string, detail?: string) => Promise<void>
  onOpenFile: (cb: (path: string) => void) => () => void
}
