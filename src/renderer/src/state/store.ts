import { create } from 'zustand'
import type { BrushType, ShapeType, ToolId } from '../engine/tools'
import type { Bounds } from '../engine/selection'
import type { SaveFormat } from '../engine/format'

export type Language = 'de' | 'en'
export type DialogType = 'resize' | 'canvas-size' | 'edit-colors' | 'properties' | 'about' | 'unsaved'

export interface LayerMeta {
  id: string
  name: string
  visible: boolean
  thumbnail: string
  active: boolean
}

export interface ViewState {
  zoom: number
  offsetX: number
  offsetY: number
  vw: number
  vh: number
  fitMode: boolean
  initialized: boolean
}

export interface UIState {
  tool: ToolId
  brushType: BrushType
  brushSize: number
  shapeType: ShapeType
  shapeOutline: boolean
  shapeFill: boolean
  shapeThickness: number
  color1: string
  color2: string
  recentColors: string[]
  language: Language
  layersOpen: boolean
  showRulers: boolean
  showGrid: boolean
  showStatus: boolean
  dialog: DialogType | null
  editingColor: 1 | 2
  docVersion: number
  docWidth: number
  docHeight: number
  dpi: number
  dirty: boolean
  fileName: string
  filePath: string | null
  format: SaveFormat
  layers: LayerMeta[]
  activeLayerId: string
  selection: Bounds | null
  undoCount: number
  redoCount: number
  recentFiles: string[]
  view: ViewState

  setTool: (tool: ToolId) => void
  setBrushType: (type: BrushType) => void
  setBrushSize: (size: number) => void
  setShapeType: (type: ShapeType) => void
  setShapeOutline: (value: boolean) => void
  setShapeFill: (value: boolean) => void
  setShapeThickness: (value: number) => void
  setColor1: (color: string) => void
  setColor2: (color: string) => void
  swapColors: () => void
  addRecentColor: (color: string) => void
  setLanguage: (language: Language) => void
  setLayersOpen: (open: boolean) => void
  toggleRulers: () => void
  toggleGrid: () => void
  toggleStatus: () => void
  openDialog: (dialog: DialogType) => void
  openColorDialog: (target: 1 | 2) => void
  closeDialog: () => void
  setViewportSize: (w: number, h: number) => void
  fitToWindow: () => void
  zoomAt: (zoom: number, sx: number, sy: number) => void
  zoomTo: (zoom: number) => void
  zoomStep: (direction: 1 | -1) => void
  panBy: (dx: number, dy: number) => void
  setViewOffset: (x: number, y: number) => void
  syncDoc: (meta: {
    docVersion?: number
    docWidth: number
    docHeight: number
    dpi: number
    dirty: boolean
    fileName: string
    filePath: string | null
    format: SaveFormat
    layers: LayerMeta[]
    activeLayerId: string
    selection: Bounds | null
    undoCount: number
    redoCount: number
  }) => void
  setRecentFiles: (files: string[]) => void
  addRecentFile: (file: string) => void
}

const storedLanguage = (localStorage.getItem('paint.language') as Language | null) ?? 'de'
const storedRecent = (() => {
  try {
    const raw = localStorage.getItem('paint.recent')
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
})()

const MIN_ZOOM = 0.1
const MAX_ZOOM = 8

function clampZoom(zoom: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom))
}

function clampOffset(
  offsetX: number,
  offsetY: number,
  zoom: number,
  docW: number,
  docH: number,
  vw: number,
  vh: number
): { x: number; y: number } {
  const cw = docW * zoom
  const ch = docH * zoom
  const margin = 20
  let x: number
  let y: number
  if (cw <= vw) x = (vw - cw) / 2
  else x = Math.max(vw - cw - margin, Math.min(margin, offsetX))
  if (ch <= vh) y = (vh - ch) / 2
  else y = Math.max(vh - ch - margin, Math.min(margin, offsetY))
  return { x, y }
}

export const useUI = create<UIState>((set, get) => ({
  tool: 'pencil',
  brushType: 'brush',
  brushSize: 6,
  shapeType: 'line',
  shapeOutline: true,
  shapeFill: false,
  shapeThickness: 2,
  color1: '#000000',
  color2: '#ffffff',
  recentColors: [],
  language: storedLanguage,
  layersOpen: false,
  showRulers: true,
  showGrid: false,
  showStatus: true,
  dialog: null,
  editingColor: 1,
  docVersion: 0,
  docWidth: 1000,
  docHeight: 562,
  dpi: 96,
  dirty: false,
  fileName: 'Unbenannt',
  filePath: null,
  format: 'png',
  layers: [],
  activeLayerId: '',
  selection: null,
  undoCount: 0,
  redoCount: 0,
  recentFiles: storedRecent,
  view: { zoom: 1, offsetX: 0, offsetY: 0, vw: 0, vh: 0, fitMode: true, initialized: false },

  setTool: (tool) => set({ tool }),
  setBrushType: (brushType) => set({ brushType }),
  setBrushSize: (brushSize) => set({ brushSize: Math.max(1, Math.min(200, Math.round(brushSize))) }),
  setShapeType: (shapeType) => set({ shapeType }),
  setShapeOutline: (shapeOutline) => set({ shapeOutline }),
  setShapeFill: (shapeFill) => set({ shapeFill }),
  setShapeThickness: (shapeThickness) => set({ shapeThickness: Math.max(1, Math.min(100, Math.round(shapeThickness))) }),
  setColor1: (color1) => set({ color1 }),
  setColor2: (color2) => set({ color2 }),
  swapColors: () => set((s) => ({ color1: s.color2, color2: s.color1 })),
  addRecentColor: (color) =>
    set((s) => {
      const recentColors = [color, ...s.recentColors.filter((c) => c !== color)].slice(0, 10)
      return { recentColors }
    }),
  setLanguage: (language) => {
    localStorage.setItem('paint.language', language)
    set({ language })
  },
  setLayersOpen: (layersOpen) => set({ layersOpen }),
  toggleRulers: () => set((s) => ({ showRulers: !s.showRulers })),
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  toggleStatus: () => set((s) => ({ showStatus: !s.showStatus })),
  openDialog: (dialog) => set({ dialog }),
  openColorDialog: (target) => set({ editingColor: target, dialog: 'edit-colors' }),
  closeDialog: () => set({ dialog: null }),

  setViewportSize: (vw, vh) => {
    const state = get()
    const old = state.view
    if (!old.initialized) {
      const zoom = clampZoom(Math.min((vw - 16) / state.docWidth, (vh - 16) / state.docHeight, 1))
      const off = clampOffset(0, 0, zoom, state.docWidth, state.docHeight, vw, vh)
      set({ view: { zoom, offsetX: off.x, offsetY: off.y, vw, vh, fitMode: false, initialized: true } })
      return
    }
    const centerDocX = (old.vw / 2 - old.offsetX) / old.zoom
    const centerDocY = (old.vh / 2 - old.offsetY) / old.zoom
    const ox = vw / 2 - centerDocX * old.zoom
    const oy = vh / 2 - centerDocY * old.zoom
    const off = clampOffset(ox, oy, old.zoom, state.docWidth, state.docHeight, vw, vh)
    set({ view: { ...old, vw, vh, offsetX: off.x, offsetY: off.y, fitMode: false } })
  },

  fitToWindow: () => {
    const { view, docWidth, docHeight } = get()
    const zoom = clampZoom(Math.min((view.vw - 16) / docWidth, (view.vh - 16) / docHeight, 1))
    const off = clampOffset(0, 0, zoom, docWidth, docHeight, view.vw, view.vh)
    set({ view: { ...view, zoom, offsetX: off.x, offsetY: off.y, fitMode: false } })
  },

  zoomAt: (zoom, sx, sy) => {
    const { view, docWidth, docHeight } = get()
    const next = clampZoom(zoom)
    const docX = (sx - view.offsetX) / view.zoom
    const docY = (sy - view.offsetY) / view.zoom
    const ox = sx - docX * next
    const oy = sy - docY * next
    const off = clampOffset(ox, oy, next, docWidth, docHeight, view.vw, view.vh)
    set({ view: { ...view, zoom: next, offsetX: off.x, offsetY: off.y, fitMode: false } })
  },

  zoomTo: (zoom) => {
    const { view } = get()
    get().zoomAt(zoom, view.vw / 2, view.vh / 2)
  },

  zoomStep: (direction) => {
    const { view } = get()
    const presets = [0.1, 0.125, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 6, 8]
    let target = view.zoom
    if (direction > 0) target = presets.find((p) => p > view.zoom + 0.001) ?? MAX_ZOOM
    else target = [...presets].reverse().find((p) => p < view.zoom - 0.001) ?? MIN_ZOOM
    get().zoomTo(target)
  },

  panBy: (dx, dy) => {
    const { view, docWidth, docHeight } = get()
    const off = clampOffset(view.offsetX + dx, view.offsetY + dy, view.zoom, docWidth, docHeight, view.vw, view.vh)
    set({ view: { ...view, offsetX: off.x, offsetY: off.y, fitMode: false } })
  },

  setViewOffset: (x, y) => {
    const { view, docWidth, docHeight } = get()
    const off = clampOffset(x, y, view.zoom, docWidth, docHeight, view.vw, view.vh)
    set({ view: { ...view, offsetX: off.x, offsetY: off.y, fitMode: false } })
  },

  syncDoc: (meta) =>
    set((s) => ({
      ...meta,
      docVersion: (meta.docVersion ?? s.docVersion) + 1
    })),

  setRecentFiles: (recentFiles) => {
    localStorage.setItem('paint.recent', JSON.stringify(recentFiles))
    set({ recentFiles })
  },
  addRecentFile: (file) => {
    const files = [file, ...get().recentFiles.filter((f) => f !== file)].slice(0, 10)
    localStorage.setItem('paint.recent', JSON.stringify(files))
    set({ recentFiles: files })
  }
}))

export function setLanguage(language: Language): void {
  useUI.getState().setLanguage(language)
}
