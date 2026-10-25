import { app, BrowserWindow, dialog, ipcMain, clipboard, ClipboardItem, shell, screen, Menu } from 'electron'
import { join, basename, dirname } from 'node:path'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

let mainWindow: BrowserWindow | null = null
let allowClose = false
let pendingOpenPath: string | null = null

function imagePathFromArgs(argv: string[]): string | null {
  for (let i = 1; i < argv.length; i++) {
    let arg = argv[i]
    if (!arg || arg.startsWith('-')) continue
    if (arg.startsWith('file://')) {
      try {
        arg = fileURLToPath(arg)
      } catch {
        continue
      }
    }
    if (/\.(png|jpe?g|bmp|gif|tiff?|webp)$/i.test(arg)) return arg
  }
  return null
}

const hasSingleInstanceLock = app.requestSingleInstanceLock()
if (!hasSingleInstanceLock) {
  app.quit()
} else {
  pendingOpenPath = imagePathFromArgs(process.argv)
}

app.on('second-instance', (_event, argv) => {
  const path = imagePathFromArgs(argv)
  if (!mainWindow) {
    pendingOpenPath = path
    return
  }
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
  if (path) mainWindow.webContents.send('app:open-file', path)
})

interface StoredWindowState {
  x?: number
  y?: number
  width?: number
  height?: number
  maximized?: boolean
}

function statePath(): string {
  return join(app.getPath('userData'), 'window-state.json')
}

async function loadWindowState(): Promise<StoredWindowState> {
  try {
    const raw = await readFile(statePath(), 'utf8')
    return JSON.parse(raw) as StoredWindowState
  } catch {
    return {}
  }
}

async function saveWindowState(): Promise<void> {
  if (!mainWindow) return
  const bounds = mainWindow.getNormalBounds()
  const state: StoredWindowState = {
    ...bounds,
    maximized: mainWindow.isMaximized()
  }
  try {
    await mkdir(dirname(statePath()), { recursive: true })
    await writeFile(statePath(), JSON.stringify(state), 'utf8')
  } catch {
    // ignore
  }
}

function clampWindowToDisplay(state: StoredWindowState): StoredWindowState {
  if (typeof state.x !== 'number' || typeof state.y !== 'number') return state
  const displays = screen.getAllDisplays()
  const visible = displays.some((d) => {
    const b = d.workArea
    return (
      state.x! < b.x + b.width - 80 &&
      state.x! + (state.width ?? 800) > b.x + 80 &&
      state.y! < b.y + b.height - 80 &&
      state.y! + (state.height ?? 600) > b.y + 40
    )
  })
  if (!visible) {
    return { width: state.width, height: state.height, maximized: state.maximized }
  }
  return state
}

const IMAGE_FILTERS = [
  { name: 'Bilder', extensions: ['png', 'jpg', 'jpeg', 'bmp', 'gif', 'tif', 'tiff', 'webp'] },
  { name: 'Alle Dateien', extensions: ['*'] }
]

async function createWindow(): Promise<void> {
  const stored = clampWindowToDisplay(await loadWindowState())
  const forceWidth = process.env['PAINT_WINDOW_WIDTH'] ? Number(process.env['PAINT_WINDOW_WIDTH']) : undefined
  const forceHeight = process.env['PAINT_WINDOW_HEIGHT'] ? Number(process.env['PAINT_WINDOW_HEIGHT']) : undefined
  const screenshotMode = Boolean(process.env['PAINT_SCREENSHOT'])

  mainWindow = new BrowserWindow({
    width: forceWidth ?? (screenshotMode ? 1366 : stored.width ?? 1366),
    height: forceHeight ?? (screenshotMode ? 768 : stored.height ?? 768),
    x: forceWidth ? undefined : screenshotMode ? undefined : stored.x,
    y: forceHeight ? undefined : screenshotMode ? undefined : stored.y,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    show: false,
    backgroundColor: '#f3f3f3',
    title: 'Unbenannt - Paint',
    autoHideMenuBar: true,
    icon: join(__dirname, '../../build/icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false
    }
  })

  if (stored.maximized) mainWindow.maximize()

  mainWindow.on('maximize', () => mainWindow?.webContents.send('window:maximized-change', true))
  mainWindow.on('unmaximize', () => mainWindow?.webContents.send('window:maximized-change', false))
  mainWindow.on('close', (e) => {
    if (!allowClose) {
      e.preventDefault()
      mainWindow?.webContents.send('window:close-requested')
      return
    }
    void saveWindowState()
  })
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })
  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    console.log(`[renderer:${level}] ${message} (${sourceId}:${line})`)
  })
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('[renderer gone]', details)
  })
  mainWindow.webContents.on('did-fail-load', (_event, code, desc, url) => {
    console.error('[load failed]', code, desc, url)
  })
  mainWindow.webContents.on('will-navigate', (e, url) => {
    if (url !== mainWindow?.webContents.getURL()) e.preventDefault()
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    await mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    await mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
    if (!process.env['PAINT_SCREENSHOT'] && pendingOpenPath) {
      const openPath = pendingOpenPath
      pendingOpenPath = null
      setTimeout(() => mainWindow?.webContents.send('app:open-file', openPath), 350)
    }
    if (process.env['PAINT_SCREENSHOT']) {
      setTimeout(async () => {
        if (!mainWindow) return
        try {
          const image = await mainWindow.webContents.capturePage()
          await writeFile(process.env['PAINT_SCREENSHOT']!, image.toPNG())
        } catch (err) {
          console.error('screenshot failed', err)
        } finally {
          allowClose = true
          app.exit(0)
        }
      }, Number(process.env['PAINT_SCREENSHOT_DELAY'] ?? 1800))
    }
  })
}

function registerIpc(): void {
  ipcMain.handle('window:minimize', () => mainWindow?.minimize())
  ipcMain.handle('window:toggle-maximize', () => {
    if (!mainWindow) return false
    if (mainWindow.isMaximized()) mainWindow.unmaximize()
    else mainWindow.maximize()
    return mainWindow.isMaximized()
  })
  ipcMain.handle('window:close', () => {
    allowClose = true
    mainWindow?.close()
  })
  ipcMain.handle('window:is-maximized', () => mainWindow?.isMaximized() ?? false)
  ipcMain.handle('window:get-bounds', () => mainWindow?.getBounds() ?? { x: 0, y: 0, width: 900, height: 600 })
  ipcMain.handle('window:set-bounds', (_e, bounds: { x: number; y: number; width: number; height: number }) => {
    if (!mainWindow) return
    const current = mainWindow.getBounds()
    mainWindow.setBounds({
      x: Math.round(bounds.x ?? current.x),
      y: Math.round(bounds.y ?? current.y),
      width: Math.max(900, Math.round(bounds.width ?? current.width)),
      height: Math.max(600, Math.round(bounds.height ?? current.height))
    })
  })

  ipcMain.handle('dialog:open-image', async () => {
    const testPath = process.env['PAINT_TEST_OPEN_PATH']
    if (testPath) {
      const data = await readFile(testPath)
      return { path: testPath, name: basename(testPath), data }
    }
    const res = await dialog.showOpenDialog(mainWindow!, {
      title: 'Öffnen',
      defaultPath: app.getPath('pictures'),
      properties: ['openFile'],
      filters: IMAGE_FILTERS
    })
    if (res.canceled || !res.filePaths[0]) return null
    const path = res.filePaths[0]
    const data = await readFile(path)
    return { path, name: basename(path), data }
  })

  ipcMain.handle('dialog:save-image', async (_e, suggestedName: string, extension: string) => {
    const testPath = process.env['PAINT_TEST_SAVE_PATH']
    if (testPath) return { path: testPath }
    const filters: Record<string, string[]> = {
      png: ['png'],
      jpg: ['jpg', 'jpeg'],
      bmp: ['bmp'],
      gif: ['gif'],
      tif: ['tif', 'tiff']
    }
    const ext = extension.toLowerCase()
    const res = await dialog.showSaveDialog(mainWindow!, {
      title: 'Speichern unter',
      defaultPath: join(app.getPath('pictures'), suggestedName),
      filters: [
        { name: (filters[ext]?.[0] ?? ext).toUpperCase(), extensions: filters[ext] ?? [ext] },
        { name: 'Alle Dateien', extensions: ['*'] }
      ]
    })
    if (res.canceled || !res.filePath) return null
    return { path: res.filePath }
  })

  ipcMain.handle('fs:read', async (_e, path: string) => {
    const buf = await readFile(path)
    return new Uint8Array(buf)
  })

  ipcMain.handle('fs:write', async (_e, path: string, data: Uint8Array) => {
    await writeFile(path, Buffer.from(data))
  })

  ipcMain.handle('clipboard:read-image', async () => {
    try {
      const items = await clipboard.read()
      for (const item of items) {
        const type = item.types.find((t) => t === 'image/png') ?? item.types.find((t) => t.startsWith('image/'))
        if (!type) continue
        const blob = await item.getType(type)
        if (blob instanceof Blob) return new Uint8Array(await blob.arrayBuffer())
        if (blob && typeof blob === 'object' && 'data' in blob) {
          return new Uint8Array((blob as { data: ArrayBuffer }).data)
        }
      }
      return null
    } catch {
      return null
    }
  })
  ipcMain.handle('clipboard:write-image', async (_e, data: Uint8Array) => {
    const blob = new Blob([data as BlobPart], { type: 'image/png' })
    await clipboard.write([new ClipboardItem({ 'image/png': blob })])
  })
  ipcMain.handle('clipboard:read-text', () => clipboard.readText())
  ipcMain.handle('clipboard:write-text', (_e, text: string) => clipboard.writeText(text))

  ipcMain.handle('fonts:list', async () => {
    try {
      const { stdout } = await execFileAsync('fc-list', ['--format', '%{family}\\n'], { maxBuffer: 8 * 1024 * 1024 })
      const set = new Set<string>()
      for (const line of stdout.split('\n')) {
        for (const name of line.split(',')) {
          const clean = name.trim()
          if (clean) set.add(clean)
        }
      }
      return [...set].sort((a, b) => a.localeCompare(b, 'de'))
    } catch {
      return ['Noto Sans', 'DejaVu Sans', 'Liberation Sans']
    }
  })

  ipcMain.handle('app:version', () => app.getVersion())
  ipcMain.handle('print:image', async (_e, dataUrl: string) => {
    const printWindow = new BrowserWindow({
      show: false,
      width: 1000,
      height: 800,
      webPreferences: { sandbox: true, contextIsolation: true }
    })
    const html = `<!doctype html><html><body style="margin:0"><img src="${dataUrl}" style="max-width:100%;max-height:100vh;display:block;margin:auto"></body></html>`
    await printWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
    printWindow.webContents.print({}, () => printWindow.close())
  })
}

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null)
  registerIpc()
  await createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow()
  })
})

app.on('window-all-closed', () => {
  app.quit()
})
