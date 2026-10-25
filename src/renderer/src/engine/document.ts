import { createCanvas, get2d, cloneCanvas, invertImage } from './canvas'
import type { Bounds } from './selection'

export interface Layer {
  id: string
  name: string
  visible: boolean
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
}

export interface DocSnapshot {
  width: number
  height: number
  dpi: number
  activeLayerId: string
  layers: Array<{ id: string; name: string; visible: boolean; data: ImageData }>
  bytes: number
}

let layerCounter = 0

export function newLayerId(): string {
  layerCounter += 1
  return `layer-${Date.now().toString(36)}-${layerCounter}`
}

function layerIsOpaque(layer: Layer): boolean {
  const { width, height } = layer.canvas
  if (width === 0 || height === 0) return false
  const data = layer.ctx.getImageData(0, 0, width, height).data
  const stepsX = Math.min(24, width)
  const stepsY = Math.min(24, height)
  for (let gy = 0; gy < stepsY; gy++) {
    const y = Math.floor((gy / Math.max(1, stepsY - 1)) * (height - 1))
    for (let gx = 0; gx < stepsX; gx++) {
      const x = Math.floor((gx / Math.max(1, stepsX - 1)) * (width - 1))
      if (data[(y * width + x) * 4 + 3] !== 255) return false
    }
  }
  return true
}

export class PaintDocument {
  width = 1000
  height = 562
  dpi = 96
  layers: Layer[] = []
  activeLayerId = ''

  constructor(width = 1000, height = 562, white = true) {
    this.reset(width, height, white)
  }

  reset(width: number, height: number, white = true): void {
    this.width = Math.max(1, Math.round(width))
    this.height = Math.max(1, Math.round(height))
    this.layers = []
    this.activeLayerId = ''
    const layer = this.makeLayer('Ebene 1', white)
    this.layers.push(layer)
    this.activeLayerId = layer.id
  }

  makeLayer(name: string, white = false): Layer {
    const canvas = createCanvas(this.width, this.height)
    const ctx = get2d(canvas, true)
    if (white) {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, this.width, this.height)
    }
    return { id: newLayerId(), name, visible: true, canvas, ctx }
  }

  get activeLayer(): Layer {
    return this.layers.find((l) => l.id === this.activeLayerId) ?? this.layers[this.layers.length - 1]
  }

  get activeIndex(): number {
    return this.layers.findIndex((l) => l.id === this.activeLayerId)
  }

  findLayer(id: string): Layer | undefined {
    return this.layers.find((l) => l.id === id)
  }

  addLayer(aboveId = this.activeLayerId, name?: string): Layer {
    const layer = this.makeLayer(name ?? `Ebene ${this.layers.length + 1}`)
    const idx = this.layers.findIndex((l) => l.id === aboveId)
    const insert = idx >= 0 ? idx + 1 : this.layers.length
    this.layers.splice(insert, 0, layer)
    this.activeLayerId = layer.id
    return layer
  }

  duplicateLayer(id = this.activeLayerId): Layer | null {
    const src = this.findLayer(id)
    if (!src) return null
    const copy = this.makeLayer(`${src.name} Kopie`)
    get2d(copy.canvas).drawImage(src.canvas, 0, 0)
    const idx = this.layers.findIndex((l) => l.id === id)
    this.layers.splice(idx + 1, 0, copy)
    this.activeLayerId = copy.id
    return copy
  }

  removeLayer(id = this.activeLayerId): boolean {
    if (this.layers.length <= 1) return false
    const idx = this.layers.findIndex((l) => l.id === id)
    if (idx < 0) return false
    this.layers.splice(idx, 1)
    this.activeLayerId = this.layers[Math.max(0, idx - 1)].id
    return true
  }

  moveLayer(id: string, targetIndex: number): void {
    const idx = this.layers.findIndex((l) => l.id === id)
    if (idx < 0) return
    const [layer] = this.layers.splice(idx, 1)
    const clamped = Math.max(0, Math.min(this.layers.length, targetIndex))
    this.layers.splice(clamped, 0, layer)
    this.activeLayerId = layer.id
  }

  mergeDown(id = this.activeLayerId): boolean {
    const idx = this.layers.findIndex((l) => l.id === id)
    if (idx <= 0) return false
    const top = this.layers[idx]
    const below = this.layers[idx - 1]
    below.ctx.drawImage(top.canvas, 0, 0)
    this.layers.splice(idx, 1)
    this.activeLayerId = below.id
    return true
  }

  composite(target?: CanvasRenderingContext2D, includeHidden = false): HTMLCanvasElement {
    const out = createCanvas(this.width, this.height)
    const ctx = target ?? get2d(out)
    for (const layer of this.layers) {
      if (!layer.visible && !includeHidden) continue
      ctx.drawImage(layer.canvas, 0, 0)
    }
    return out
  }

  flatten(background?: string): HTMLCanvasElement {
    const out = createCanvas(this.width, this.height)
    const ctx = get2d(out)
    if (background) {
      ctx.fillStyle = background
      ctx.fillRect(0, 0, this.width, this.height)
    }
    for (const layer of this.layers) {
      if (!layer.visible) continue
      ctx.drawImage(layer.canvas, 0, 0)
    }
    return out
  }

  loadCanvas(source: HTMLCanvasElement): void {
    this.width = source.width
    this.height = source.height
    this.layers = []
    const layer = this.makeLayer('Ebene 1')
    get2d(layer.canvas).drawImage(source, 0, 0)
    this.layers.push(layer)
    this.activeLayerId = layer.id
  }

  resizeImage(width: number, height: number): void {
    const w = Math.max(1, Math.round(width))
    const h = Math.max(1, Math.round(height))
    for (const layer of this.layers) {
      const out = createCanvas(w, h)
      const ctx = get2d(out)
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(layer.canvas, 0, 0, w, h)
      layer.canvas = out
      layer.ctx = ctx
    }
    this.width = w
    this.height = h
  }

  resizeCanvas(width: number, height: number, anchor: 'top-left' | 'center' = 'top-left'): void {
    const w = Math.max(1, Math.round(width))
    const h = Math.max(1, Math.round(height))
    const dx = anchor === 'center' ? Math.round((w - this.width) / 2) : 0
    const dy = anchor === 'center' ? Math.round((h - this.height) / 2) : 0
    this.layers = this.layers.map((layer, index) => {
      const out = createCanvas(w, h)
      const ctx = get2d(out)
      if (index === 0 && layerIsOpaque(layer)) {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, w, h)
      }
      ctx.drawImage(layer.canvas, dx, dy)
      layer.canvas = out
      layer.ctx = ctx
      return layer
    })
    this.width = w
    this.height = h
  }

  rotate(degrees: 90 | 180 | 270): void {
    const angle = (degrees * Math.PI) / 180
    const swap = degrees === 90 || degrees === 270
    const w = swap ? this.height : this.width
    const h = swap ? this.width : this.height
    for (const layer of this.layers) {
      const out = createCanvas(w, h)
      const ctx = get2d(out)
      ctx.translate(w / 2, h / 2)
      ctx.rotate(angle)
      ctx.drawImage(layer.canvas, -this.width / 2, -this.height / 2)
      layer.canvas = out
      layer.ctx = ctx
    }
    this.width = w
    this.height = h
  }

  flip(horizontal: boolean): void {
    for (const layer of this.layers) {
      const out = createCanvas(this.width, this.height)
      const ctx = get2d(out)
      ctx.translate(horizontal ? this.width : 0, horizontal ? 0 : this.height)
      ctx.scale(horizontal ? -1 : 1, horizontal ? 1 : -1)
      ctx.drawImage(layer.canvas, 0, 0)
      layer.canvas = out
      layer.ctx = ctx
    }
  }

  invertColors(): void {
    for (const layer of this.layers) invertImage(layer.canvas)
  }

  skew(horizontalDeg: number, verticalDeg: number): void {
    const tanX = Math.tan((Math.max(-89, Math.min(89, horizontalDeg)) * Math.PI) / 180)
    const tanY = Math.tan((Math.max(-89, Math.min(89, verticalDeg)) * Math.PI) / 180)
    const offX = Math.max(0, -tanX * this.height)
    const offY = Math.max(0, -tanY * this.width)
    this.layers = this.layers.map((layer, index) => {
      const out = createCanvas(this.width, this.height)
      const ctx = get2d(out)
      if (index === 0 && layerIsOpaque(layer)) {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, this.width, this.height)
      }
      ctx.setTransform(1, tanY, tanX, 1, offX, offY)
      ctx.drawImage(layer.canvas, 0, 0)
      layer.canvas = out
      layer.ctx = ctx
      return layer
    })
  }

  crop(rect: Bounds): void {
    const w = Math.max(1, Math.round(rect.w))
    const h = Math.max(1, Math.round(rect.h))
    for (const layer of this.layers) {
      const out = createCanvas(w, h)
      get2d(out).drawImage(layer.canvas, -rect.x, -rect.y)
      layer.canvas = out
      layer.ctx = get2d(out, true)
    }
    this.width = w
    this.height = h
  }

  snapshot(): DocSnapshot {
    let bytes = 0
    const layers = this.layers.map((l) => {
      const data = l.ctx.getImageData(0, 0, this.width, this.height)
      bytes += data.data.byteLength
      return { id: l.id, name: l.name, visible: l.visible, data }
    })
    return {
      width: this.width,
      height: this.height,
      dpi: this.dpi,
      activeLayerId: this.activeLayerId,
      layers,
      bytes
    }
  }

  restore(snap: DocSnapshot): void {
    this.width = snap.width
    this.height = snap.height
    this.dpi = snap.dpi
    this.layers = snap.layers.map((s) => {
      const canvas = createCanvas(snap.width, snap.height)
      const ctx = get2d(canvas, true)
      ctx.putImageData(s.data, 0, 0)
      return { id: s.id, name: s.name, visible: s.visible, canvas, ctx }
    })
    this.activeLayerId = snap.activeLayerId
  }

  clone(): PaintDocument {
    const doc = new PaintDocument(this.width, this.height, false)
    doc.dpi = this.dpi
    doc.layers = this.layers.map((l) => {
      const canvas = cloneCanvas(l.canvas)
      return {
        id: l.id,
        name: l.name,
        visible: l.visible,
        canvas,
        ctx: get2d(canvas, true)
      }
    })
    doc.activeLayerId = this.activeLayerId
    return doc
  }
}
