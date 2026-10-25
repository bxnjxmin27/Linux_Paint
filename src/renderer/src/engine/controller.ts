import { PaintDocument, type Layer } from './document'
import { History, type HistoryEntry } from './history'
import { Selection, type Bounds, type Point } from './selection'
import {
  createCanvas,
  get2d,
  makeThumbnail,
  hexToRgba,
  cloneCanvas,
  canvasToBytes
} from './canvas'
import { useUI, type LayerMeta } from '../state/store'
import { useText, type TextStyle, type TextSession } from '../state/text'
import { decodeImageFile, encodeCanvas, formatFromFilename, defaultExtension, type SaveFormat } from './format'
import { drawShape, type ShapeOptions } from './shapes'
import type { ShapeType, ToolId } from './tools'

export interface FloatingSelection {
  canvas: HTMLCanvasElement
  x: number
  y: number
  w: number
  h: number
  rotation: number
  cut: boolean
}

type HandleMode = 'move' | 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'rotate'

interface FloatingDragState {
  mode: HandleMode
  start: { x: number; y: number }
  rect: { x: number; y: number; w: number; h: number; rotation: number }
  center: { x: number; y: number }
  startAngle: number
}

function getApi(): Window['paint'] {
  return window.paint
}

export class PaintController {
  doc = new PaintDocument(1000, 562, true)
  history = new History()
  selection: Selection | null = null
  floating: FloatingSelection | null = null
  filePath: string | null = null
  format: SaveFormat = 'png'
  dirty = false
  repaint: (() => void) | null = null

  private pixelEdit: { layerId: string; before: ImageData } | null = null
  private floatingDrag: FloatingDragState | null = null

  initialize(): void {
    this.syncMeta()
    this.syncSelection()
  }

  private currentFileName(): string {
    if (!this.filePath) return useUI.getState().language === 'de' ? 'Unbenannt' : 'Untitled'
    return this.filePath.split('/').pop() ?? this.filePath
  }

  syncSelection(): void {
    const bounds = this.floating ? this.floatingBounds() : this.selection?.bounds ?? null
    useUI.setState({ selection: bounds })
  }

  syncMeta(): void {
    const layers: LayerMeta[] = this.doc.layers
      .map((layer) => ({
        id: layer.id,
        name: layer.name,
        visible: layer.visible,
        thumbnail: makeThumbnail(layer.canvas),
        active: layer.id === this.doc.activeLayerId
      }))
      .reverse()

    const fileName = this.currentFileName()
    useUI.getState().syncDoc({
      docWidth: this.doc.width,
      docHeight: this.doc.height,
      dpi: this.doc.dpi,
      dirty: this.dirty,
      fileName,
      filePath: this.filePath,
      format: this.format,
      layers,
      activeLayerId: this.doc.activeLayerId,
      selection: this.floating ? this.floatingBounds() : this.selection?.bounds ?? null,
      undoCount: this.history.undoCount,
      redoCount: this.history.redoCount
    })
    document.title = `${fileName} - Paint`
    this.repaint?.()
  }

  bump(): void {
    this.repaint?.()
    this.syncSelection()
  }

  activeLayer(): Layer {
    return this.doc.activeLayer
  }

  private settle(): void {
    if (this.floating) this.commitFloating()
  }

  hasDocument(): boolean {
    return this.doc.layers.length > 0
  }

  // ---------- history ----------

  beginPixelEdit(layerId = this.doc.activeLayerId): void {
    if (this.pixelEdit) this.endPixelEdit('Änderung')
    const layer = this.doc.findLayer(layerId)
    if (!layer) return
    this.pixelEdit = {
      layerId,
      before: layer.ctx.getImageData(0, 0, this.doc.width, this.doc.height)
    }
  }

  cancelPixelEdit(restore = true): void {
    if (this.pixelEdit && restore) {
      const layer = this.doc.findLayer(this.pixelEdit.layerId)
      if (layer) layer.ctx.putImageData(this.pixelEdit.before, 0, 0)
    }
    this.pixelEdit = null
    this.bump()
  }

  endPixelEdit(label: string): void {
    if (!this.pixelEdit) return
    const layer = this.doc.findLayer(this.pixelEdit.layerId)
    if (!layer) {
      this.pixelEdit = null
      return
    }
    const before = this.pixelEdit.before
    const after = layer.ctx.getImageData(0, 0, this.doc.width, this.doc.height)
    if (imagesEqual(before, after)) {
      this.pixelEdit = null
      this.bump()
      return
    }
    const layerId = this.pixelEdit.layerId
    const bytes = before.data.byteLength * 2
    this.pixelEdit = null
    const entry: HistoryEntry = {
      label,
      bytes,
      undo: () => {
        const l = this.doc.findLayer(layerId)
        if (l) l.ctx.putImageData(before, 0, 0)
      },
      redo: () => {
        const l = this.doc.findLayer(layerId)
        if (l) l.ctx.putImageData(after, 0, 0)
      }
    }
    this.history.push(entry)
    this.dirty = true
    this.syncMeta()
  }

  private snapshotTransaction(label: string, fn: () => void, fit = false): void {
    const before = this.doc.snapshot()
    fn()
    const after = this.doc.snapshot()
    this.history.push({
      label,
      bytes: before.bytes + after.bytes,
      undo: () => this.doc.restore(before),
      redo: () => this.doc.restore(after)
    })
    this.dirty = true
    this.selection = null
    this.floating = null
    this.syncSelection()
    this.syncMeta()
    if (fit) useUI.getState().fitToWindow()
    this.repaint?.()
  }

  undo(): void {
    if (this.pixelEdit) this.endPixelEdit('Änderung')
    if (this.floating) this.commitFloating()
    const w = this.doc.width
    const h = this.doc.height
    const entry = this.history.undo()
    if (!entry) return
    this.selection = null
    this.floating = null
    this.dirty = true
    this.syncSelection()
    this.syncMeta()
    if (w !== this.doc.width || h !== this.doc.height) useUI.getState().fitToWindow()
  }

  redo(): void {
    if (this.pixelEdit) this.endPixelEdit('Änderung')
    if (this.floating) this.commitFloating()
    const w = this.doc.width
    const h = this.doc.height
    const entry = this.history.redo()
    if (!entry) return
    this.selection = null
    this.floating = null
    this.dirty = true
    this.syncSelection()
    this.syncMeta()
    if (w !== this.doc.width || h !== this.doc.height) useUI.getState().fitToWindow()
  }

  // ---------- document ----------

  newDocument(width = 1000, height = 562): void {
    this.floating = null
    this.pixelEdit = null
    this.selection = null
    this.history.clear()
    this.doc.reset(width, height, true)
    this.doc.dpi = 96
    this.doc.layers[0].name = useUI.getState().language === 'de' ? 'Ebene 1' : 'Layer 1'
    this.filePath = null
    this.format = 'png'
    this.dirty = false
    this.syncSelection()
    this.syncMeta()
    useUI.getState().fitToWindow()
  }

  loadCanvas(canvas: HTMLCanvasElement, path: string | null, name: string): void {
    this.floating = null
    this.pixelEdit = null
    this.selection = null
    this.history.clear()
    this.doc.loadCanvas(canvas)
    this.doc.layers[0].name = useUI.getState().language === 'de' ? 'Ebene 1' : 'Layer 1'
    this.filePath = path
    this.format = path ? formatFromFilename(path) : 'png'
    this.dirty = false
    this.syncSelection()
    this.syncMeta()
    useUI.getState().fitToWindow()
    if (path) useUI.getState().addRecentFile(path)
    document.title = `${name} - Paint`
  }

  async openDialog(): Promise<void> {
    const api = getApi()
    const result = await api.openImage()
    if (!result) return
    const canvas = await decodeImageFile(result.data, result.name)
    this.loadCanvas(canvas, result.path, result.name)
  }

  async openPath(path: string): Promise<void> {
    const api = getApi()
    const data = await api.readFile(path)
    const name = path.split('/').pop() ?? path
    const canvas = await decodeImageFile(data, name)
    this.loadCanvas(canvas, path, name)
  }

  getComposite(): HTMLCanvasElement {
    return this.doc.flatten()
  }

  getExportCanvas(): HTMLCanvasElement {
    if (!this.floating) return this.doc.flatten()
    const out = this.doc.flatten()
    const ctx = get2d(out)
    drawFloatingOnto(ctx, this.floating, 0, 0)
    return out
  }

  async save(): Promise<boolean> {
    if (!this.filePath) return this.saveAs('png')
    const bytes = await encodeCanvas(this.getExportCanvas(), this.format)
    await getApi().writeFile(this.filePath, bytes)
    this.dirty = false
    this.syncMeta()
    useUI.getState().addRecentFile(this.filePath)
    return true
  }

  async saveAs(format: SaveFormat): Promise<boolean> {
    const ext = defaultExtension(format)
    const base = this.currentFileName().replace(/\.[^.]+$/, '') || 'Unbenannt'
    const suggested = `${base}.${ext}`
    const res = await getApi().saveImageDialog(suggested, ext)
    if (!res) return false
    let path = res.path
    if (!/\.[^.\\/]+$/.test(path)) path = `${path}.${ext}`
    const bytes = await encodeCanvas(this.getExportCanvas(), format)
    await getApi().writeFile(path, bytes)
    this.filePath = path
    this.format = format
    this.dirty = false
    this.syncMeta()
    useUI.getState().addRecentFile(path)
    return true
  }

  async print(): Promise<void> {
    const url = this.getExportCanvas().toDataURL('image/png')
    await getApi().openPrint(url)
  }

  setDpi(dpi: number): void {
    this.doc.dpi = Math.max(1, Math.round(dpi))
    this.dirty = true
    this.syncMeta()
  }

  // ---------- selection ----------

  setSelectionRect(rect: Bounds): void {
    this.commitFloating()
    this.selection = new Selection(this.doc.width, this.doc.height)
    this.selection.setRect(rect)
    this.syncSelection()
    this.repaint?.()
  }

  setSelectionPolygon(points: Point[]): void {
    this.commitFloating()
    this.selection = new Selection(this.doc.width, this.doc.height)
    this.selection.setPolygon(points)
    this.syncSelection()
    this.repaint?.()
  }

  selectAll(): void {
    this.commitFloating()
    this.selection = new Selection(this.doc.width, this.doc.height)
    this.selection.selectAll()
    this.syncSelection()
    this.repaint?.()
  }

  clearSelection(): void {
    if (this.floating) this.commitFloating()
    this.selection = null
    this.syncSelection()
    this.repaint?.()
  }

  invertSelection(): void {
    if (!this.selection) {
      this.selectAll()
      return
    }
    this.commitFloating()
    this.selection.invert()
    this.syncSelection()
    this.repaint?.()
  }

  beginSelectionTransform(): boolean {
    if (this.floating) return true
    if (!this.selection || this.selection.isEmpty) return false
    const layer = this.doc.activeLayer
    this.beginPixelEdit(layer.id)
    const extracted = this.selection.extractCanvas(layer.canvas)
    if (!extracted) {
      this.cancelPixelEdit(false)
      return false
    }
    this.selection.clearRegion(layer.ctx)
    this.selection = null
    this.floating = {
      canvas: extracted.canvas,
      x: extracted.bounds.x,
      y: extracted.bounds.y,
      w: extracted.bounds.w,
      h: extracted.bounds.h,
      rotation: 0,
      cut: true
    }
    this.syncSelection()
    this.repaint?.()
    return true
  }

  floatingBounds(): Bounds {
    if (!this.floating) return { x: 0, y: 0, w: 0, h: 0 }
    const f = this.floating
    const cx = f.x + f.w / 2
    const cy = f.y + f.h / 2
    const corners = [
      { x: f.x, y: f.y },
      { x: f.x + f.w, y: f.y },
      { x: f.x + f.w, y: f.y + f.h },
      { x: f.x, y: f.y + f.h }
    ].map((p) => rotatePoint(p, { x: cx, y: cy }, f.rotation))
    const xs = corners.map((p) => p.x)
    const ys = corners.map((p) => p.y)
    const minX = Math.min(...xs)
    const minY = Math.min(...ys)
    return {
      x: Math.round(minX),
      y: Math.round(minY),
      w: Math.round(Math.max(...xs) - minX),
      h: Math.round(Math.max(...ys) - minY)
    }
  }

  startFloatingDrag(mode: HandleMode, point: Point): boolean {
    if (!this.beginSelectionTransform()) return false
    const f = this.floating
    if (!f) return false
    const center = { x: f.x + f.w / 2, y: f.y + f.h / 2 }
    this.floatingDrag = {
      mode,
      start: point,
      rect: { x: f.x, y: f.y, w: f.w, h: f.h, rotation: f.rotation },
      center,
      startAngle: Math.atan2(point.y - center.y, point.x - center.x)
    }
    return true
  }

  dragFloating(point: Point, shift: boolean): void {
    const drag = this.floatingDrag
    const f = this.floating
    if (!drag || !f) return
    const dx = point.x - drag.start.x
    const dy = point.y - drag.start.y
    const start = drag.rect
    if (drag.mode === 'move') {
      let nx = start.x + dx
      let ny = start.y + dy
      if (shift) {
        if (Math.abs(dx) > Math.abs(dy)) ny = start.y
        else nx = start.x
      }
      f.x = Math.round(nx)
      f.y = Math.round(ny)
    } else if (drag.mode === 'rotate') {
      const angle = Math.atan2(point.y - drag.center.y, point.x - drag.center.x)
      let rotation = start.rotation + (angle - drag.startAngle)
      if (shift) rotation = Math.round(rotation / (Math.PI / 12)) * (Math.PI / 12)
      f.rotation = rotation
    } else {
      let x = start.x
      let y = start.y
      let w = start.w
      let h = start.h
      if (drag.mode.includes('e')) w = Math.max(1, start.w + dx)
      if (drag.mode.includes('s')) h = Math.max(1, start.h + dy)
      if (drag.mode.includes('w')) {
        w = Math.max(1, start.w - dx)
        x = start.x + (start.w - w)
      }
      if (drag.mode.includes('n')) {
        h = Math.max(1, start.h - dy)
        y = start.y + (start.h - h)
      }
      if (shift && drag.mode.length === 2) {
        const ratio = start.w / start.h
        if (w / h > ratio) w = h * ratio
        else h = w / ratio
        if (drag.mode.includes('w')) x = start.x + (start.w - w)
        if (drag.mode.includes('n')) y = start.y + (start.h - h)
      }
      f.x = Math.round(x)
      f.y = Math.round(y)
      f.w = Math.round(w)
      f.h = Math.round(h)
    }
    this.syncSelection()
    this.repaint?.()
  }

  endFloatingDrag(): void {
    this.floatingDrag = null
  }

  commitFloating(): void {
    const f = this.floating
    if (!f) return
    if (!f.cut) this.beginPixelEdit()
    const layer = this.doc.activeLayer
    layer.ctx.save()
    layer.ctx.imageSmoothingEnabled = true
    layer.ctx.translate(f.x + f.w / 2, f.y + f.h / 2)
    layer.ctx.rotate(f.rotation)
    layer.ctx.drawImage(f.canvas, -f.w / 2, -f.h / 2, f.w, f.h)
    layer.ctx.restore()
    const bounds = this.floatingBounds()
    this.floating = null
    this.selection = new Selection(this.doc.width, this.doc.height)
    this.selection.setRect(bounds)
    this.endPixelEdit('Auswahl')
    this.syncSelection()
    this.repaint?.()
  }

  cancelFloating(): void {
    if (!this.floating) return
    if (this.floating.cut) {
      this.cancelPixelEdit(true)
    }
    this.floating = null
    this.selection = null
    this.syncSelection()
    this.repaint?.()
  }

  deleteSelection(): void {
    if (!this.floating && (!this.selection || this.selection.isEmpty)) return
    if (this.floating) {
      if (this.floating.cut) {
        this.floating = null
        this.selection = null
        this.endPixelEdit('Löschen')
      } else {
        this.floating = null
        this.selection = null
      }
      this.dirty = true
      this.syncMeta()
      this.syncSelection()
      return
    }
    const layer = this.doc.activeLayer
    this.beginPixelEdit(layer.id)
    if (this.selection && !this.selection.isEmpty) {
      this.selection.clearRegion(layer.ctx)
    } else {
      layer.ctx.clearRect(0, 0, this.doc.width, this.doc.height)
    }
    this.selection = null
    this.endPixelEdit('Löschen')
    this.syncSelection()
  }

  async copySelection(): Promise<void> {
    let canvas: HTMLCanvasElement | null = null
    if (this.floating) {
      canvas = renderFloating(this.floating)
    } else if (this.selection && !this.selection.isEmpty) {
      const extracted = this.selection.extractCanvas(this.doc.activeLayer.canvas)
      canvas = extracted?.canvas ?? null
    } else {
      canvas = cloneCanvas(this.doc.activeLayer.canvas)
    }
    if (!canvas) return
    const bytes = await canvasToBytes(canvas, 'image/png')
    await getApi().clipboardWriteImage(bytes)
  }

  async cutSelection(): Promise<void> {
    await this.copySelection()
    this.deleteSelection()
  }

  async paste(): Promise<void> {
    const data = await getApi().clipboardReadImage()
    if (!data) return
    const blob = new Blob([data as BlobPart], { type: 'image/png' })
    const bitmap = await createImageBitmap(blob)
    const canvas = createCanvas(bitmap.width, bitmap.height)
    get2d(canvas).drawImage(bitmap, 0, 0)
    bitmap.close()
    this.commitFloating()
    this.floating = {
      canvas,
      x: 0,
      y: 0,
      w: canvas.width,
      h: canvas.height,
      rotation: 0,
      cut: false
    }
    this.selection = null
    useUI.getState().setTool('select-rect')
    this.syncSelection()
    this.syncMeta()
    this.repaint?.()
  }

  cropToSelection(): void {
    if (this.floating) this.commitFloating()
    if (!this.selection || !this.selection.bounds) return
    const bounds = { ...this.selection.bounds }
    this.snapshotTransaction('Zuschneiden', () => this.doc.crop(bounds), true)
  }

  // ---------- painting ----------

  floodFill(x: number, y: number, color: string): void {
    const px = Math.floor(x)
    const py = Math.floor(y)
    if (px < 0 || py < 0 || px >= this.doc.width || py >= this.doc.height) return
    const layer = this.doc.activeLayer
    this.beginPixelEdit(layer.id)
    const img = layer.ctx.getImageData(0, 0, this.doc.width, this.doc.height)
    const data = img.data
    const w = this.doc.width
    const h = this.doc.height
    const index = (py * w + px) * 4
    const target = [data[index], data[index + 1], data[index + 2], data[index + 3]]
    const fill = hexToRgba(color)
    if (target[0] === fill[0] && target[1] === fill[1] && target[2] === fill[2] && target[3] === fill[3]) {
      this.cancelPixelEdit(false)
      return
    }
    const mask = this.selection && !this.selection.isEmpty ? this.selection.mask : null
    const visited = new Uint8Array(w * h)
    const matches = (i: number): boolean =>
      data[i * 4] === target[0] &&
      data[i * 4 + 1] === target[1] &&
      data[i * 4 + 2] === target[2] &&
      data[i * 4 + 3] === target[3] &&
      (mask === null || mask[i] === 1)
    const stack: number[] = [py * w + px]
    while (stack.length) {
      const pos = stack.pop()!
      if (visited[pos]) continue
      visited[pos] = 1
      const yy = Math.floor(pos / w)
      const xx = pos - yy * w
      let left = xx
      let right = xx
      while (left > 0 && !visited[yy * w + left - 1] && matches(yy * w + left - 1)) left--
      while (right < w - 1 && !visited[yy * w + right + 1] && matches(yy * w + right + 1)) right++
      for (let i = left; i <= right; i++) {
        const p = yy * w + i
        visited[p] = 1
        const di = p * 4
        data[di] = fill[0]
        data[di + 1] = fill[1]
        data[di + 2] = fill[2]
        data[di + 3] = fill[3]
        if (yy > 0) {
          const up = p - w
          if (!visited[up] && matches(up)) stack.push(up)
        }
        if (yy < h - 1) {
          const down = p + w
          if (!visited[down] && matches(down)) stack.push(down)
        }
      }
    }
    layer.ctx.putImageData(img, 0, 0)
    this.endPixelEdit('Füllen')
  }

  pickColor(x: number, y: number, secondary: boolean): string | null {
    const px = Math.floor(x)
    const py = Math.floor(y)
    if (px < 0 || py < 0 || px >= this.doc.width || py >= this.doc.height) return null
    const composite = this.doc.flatten()
    const d = get2d(composite, true).getImageData(px, py, 1, 1).data
    if (d[3] === 0) return null
    const hex = `#${[d[0], d[1], d[2]].map((n) => n.toString(16).padStart(2, '0')).join('')}`
    if (secondary) useUI.getState().setColor2(hex)
    else useUI.getState().setColor1(hex)
    useUI.getState().addRecentColor(hex)
    return hex
  }

  drawShapeFinal(
    type: ShapeType,
    a: Point,
    b: Point,
    opts: ShapeOptions,
    modifiers?: { c1?: Point; c2?: Point }
  ): void {
    const layer = this.doc.activeLayer
    this.beginPixelEdit(layer.id)
    drawShape(layer.ctx, type, a, b, opts, modifiers)
    this.endPixelEdit('Form')
  }

  drawPolygonFinal(points: Point[], opts: ShapeOptions): void {
    if (points.length < 2) return
    const layer = this.doc.activeLayer
    this.beginPixelEdit(layer.id)
    const ctx = layer.ctx
    ctx.save()
    if (opts.fill) {
      ctx.beginPath()
      ctx.moveTo(points[0].x, points[0].y)
      for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y)
      ctx.closePath()
      ctx.fillStyle = opts.fillColor
      ctx.fill()
    }
    if (opts.outline) {
      ctx.beginPath()
      ctx.moveTo(points[0].x, points[0].y)
      for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y)
      ctx.closePath()
      ctx.strokeStyle = opts.outlineColor
      ctx.lineWidth = opts.thickness
      ctx.stroke()
    }
    ctx.restore()
    this.endPixelEdit('Form')
  }

  drawCurveFinal(a: Point, b: Point, c1: Point, c2: Point, opts: ShapeOptions): void {
    const layer = this.doc.activeLayer
    this.beginPixelEdit(layer.id)
    drawShape(layer.ctx, 'curve', a, b, opts, { c1, c2 })
    this.endPixelEdit('Kurve')
  }

  // ---------- text ----------

  commitText(session: TextSession, style: TextStyle): void {
    if (!session.text.trim()) {
      useText.getState().close()
      this.repaint?.()
      return
    }
    const layer = this.doc.activeLayer
    this.beginPixelEdit(layer.id)
    const ctx = layer.ctx
    const px = Math.max(1, style.size * (96 / 72))
    const weight = style.bold ? '700' : '400'
    const italic = style.italic ? 'italic ' : ''
    ctx.save()
    ctx.font = `${italic}${weight} ${px}px "${style.family}", "Selawik", "Noto Sans", sans-serif`
    ctx.textBaseline = 'top'
    ctx.fillStyle = style.color
    const lineHeight = px * 1.2
    const maxWidth = Math.max(8, session.w)
    const lines: string[] = []
    for (const paragraph of session.text.split('\n')) {
      if (!paragraph) {
        lines.push('')
        continue
      }
      const words = paragraph.split(' ')
      let current = ''
      for (const word of words) {
        const test = current ? `${current} ${word}` : word
        if (ctx.measureText(test).width <= maxWidth) {
          current = test
          continue
        }
        if (current) lines.push(current)
        current = word
        while (ctx.measureText(current).width > maxWidth && current.length > 1) {
          let cut = current.length - 1
          while (cut > 1 && ctx.measureText(current.slice(0, cut)).width > maxWidth) cut--
          lines.push(current.slice(0, cut))
          current = current.slice(cut)
        }
      }
      lines.push(current)
    }
    if (style.background) {
      ctx.fillStyle = useUI.getState().color2
      ctx.fillRect(session.x, session.y, Math.max(session.w, 8), Math.max(session.h, lineHeight * lines.length))
    }
    ctx.fillStyle = style.color
    lines.forEach((line, i) => {
      let x = session.x
      const width = ctx.measureText(line).width
      if (style.align === 'center') x = session.x + (session.w - width) / 2
      if (style.align === 'right') x = session.x + session.w - width
      const y = session.y + i * lineHeight
      ctx.fillText(line, x, y)
      if (style.underline) {
        ctx.strokeStyle = style.color
        ctx.lineWidth = Math.max(1, px * 0.06)
        ctx.beginPath()
        ctx.moveTo(x, y + px * 1.04)
        ctx.lineTo(x + width, y + px * 1.04)
        ctx.stroke()
      }
    })
    ctx.restore()
    this.endPixelEdit('Text')
    useText.getState().close()
    this.syncMeta()
  }

  // ---------- layers ----------

  setActiveLayer(id: string): void {
    if (this.floating) this.commitFloating()
    if (!this.doc.findLayer(id)) return
    this.doc.activeLayerId = id
    this.syncMeta()
    this.repaint?.()
  }

  addLayer(): void {
    this.settle()
    this.snapshotTransaction('Ebene hinzufügen', () => {
      const layer = this.doc.addLayer()
      layer.name = useUI.getState().language === 'de' ? `Ebene ${this.doc.layers.length}` : `Layer ${this.doc.layers.length}`
    })
  }

  duplicateLayer(): void {
    this.settle()
    this.snapshotTransaction('Ebene duplizieren', () => {
      const copy = this.doc.duplicateLayer()
      if (copy) {
        const base = copy.name.replace(/ (Kopie|copy)$/i, '')
        copy.name = useUI.getState().language === 'de' ? `${base} Kopie` : `${base} copy`
      }
    })
  }

  deleteLayer(): void {
    this.settle()
    if (this.doc.layers.length <= 1) return
    this.snapshotTransaction('Ebene löschen', () => {
      this.doc.removeLayer()
    })
  }

  mergeDown(): void {
    this.settle()
    if (this.doc.activeIndex <= 0) return
    this.snapshotTransaction('Nach unten zusammenführen', () => {
      this.doc.mergeDown()
    })
  }

  moveLayer(id: string, targetIndex: number): void {
    this.settle()
    if (this.doc.activeIndex === targetIndex) return
    this.snapshotTransaction('Ebene verschieben', () => {
      this.doc.moveLayer(id, targetIndex)
    })
  }

  renameLayer(id: string, name: string): void {
    const layer = this.doc.findLayer(id)
    if (!layer) return
    layer.name = name.trim() || layer.name
    this.dirty = true
    this.syncMeta()
  }

  toggleLayerVisible(id: string): void {
    const layer = this.doc.findLayer(id)
    if (!layer) return
    layer.visible = !layer.visible
    this.dirty = true
    this.syncMeta()
    this.repaint?.()
  }

  importImage(canvas: HTMLCanvasElement): void {
    this.settle()
    this.snapshotTransaction('Bild importieren', () => {
      const layer = this.doc.addLayer()
      layer.name = useUI.getState().language === 'de' ? `Ebene ${this.doc.layers.length}` : `Layer ${this.doc.layers.length}`
      layer.ctx.drawImage(canvas, 0, 0)
    }, true)
  }

  // ---------- image ----------

  resizeImage(w: number, h: number): void {
    this.settle()
    this.snapshotTransaction('Größe ändern', () => this.doc.resizeImage(w, h), true)
  }

  resizeAndSkew(w: number, h: number, skewX: number, skewY: number): void {
    this.settle()
    this.snapshotTransaction(
      'Größe ändern',
      () => {
        this.doc.resizeImage(w, h)
        if (skewX || skewY) this.doc.skew(skewX, skewY)
      },
      true
    )
  }

  skewImage(skewX: number, skewY: number): void {
    this.settle()
    if (!skewX && !skewY) return
    this.snapshotTransaction('Neigen', () => this.doc.skew(skewX, skewY), true)
  }

  resizeCanvas(w: number, h: number, anchor: 'top-left' | 'center' = 'top-left'): void {
    this.settle()
    this.snapshotTransaction('Canvas-Größe', () => this.doc.resizeCanvas(w, h, anchor), true)
  }

  rotate(degrees: 90 | 180 | 270): void {
    this.settle()
    this.snapshotTransaction('Drehen', () => this.doc.rotate(degrees), true)
  }

  flip(horizontal: boolean): void {
    this.settle()
    this.snapshotTransaction(horizontal ? 'Horizontal spiegeln' : 'Vertikal spiegeln', () => this.doc.flip(horizontal), true)
  }

  invertColors(): void {
    this.settle()
    this.snapshotTransaction('Farben umkehren', () => this.doc.invertColors())
  }

  nudgeSelection(dx: number, dy: number): void {
    if (!this.floating) {
      if (!this.selection || this.selection.isEmpty) return
      if (!this.beginSelectionTransform()) return
    }
    if (!this.floating) return
    this.floating.x += dx
    this.floating.y += dy
    this.syncSelection()
    this.repaint?.()
  }

  // ---------- tool activation ----------

  activateTool(tool: ToolId): void {
    if (useText.getState().session) {
      const session = useText.getState().session
      if (session) this.commitText(session, useText.getState().style)
    }
    if (this.floating && tool !== 'select-rect' && tool !== 'select-free') this.commitFloating()
    useUI.getState().setTool(tool)
    this.repaint?.()
  }

  // ---------- floating drawing helper ----------

  drawFloating(ctx: CanvasRenderingContext2D, pageX: number, pageY: number, zoom: number): void {
    if (!this.floating) return
    const f = this.floating
    const cx = pageX + (f.x + f.w / 2) * zoom
    const cy = pageY + (f.y + f.h / 2) * zoom
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(f.rotation)
    ctx.imageSmoothingEnabled = zoom < 1
    ctx.drawImage(f.canvas, (-f.w * zoom) / 2, (-f.h * zoom) / 2, f.w * zoom, f.h * zoom)
    ctx.restore()
  }

  getFloatingHandlePoints(): Array<{ mode: HandleMode; x: number; y: number }> {
    const f = this.floating
    if (!f) return []
    const cx = f.x + f.w / 2
    const cy = f.y + f.h / 2
    const raw: Array<{ mode: HandleMode; x: number; y: number }> = [
      { mode: 'nw', x: f.x, y: f.y },
      { mode: 'n', x: cx, y: f.y },
      { mode: 'ne', x: f.x + f.w, y: f.y },
      { mode: 'e', x: f.x + f.w, y: cy },
      { mode: 'se', x: f.x + f.w, y: f.y + f.h },
      { mode: 's', x: cx, y: f.y + f.h },
      { mode: 'sw', x: f.x, y: f.y + f.h },
      { mode: 'w', x: f.x, y: cy },
      { mode: 'rotate', x: cx, y: f.y - 26 / useUI.getState().view.zoom }
    ]
    return raw.map((p) => ({ ...p, ...rotatePoint(p, { x: cx, y: cy }, f.rotation) }))
  }
}

function rotatePoint(p: Point, center: Point, angle: number): Point {
  if (!angle) return { x: p.x, y: p.y }
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const dx = p.x - center.x
  const dy = p.y - center.y
  return { x: center.x + dx * cos - dy * sin, y: center.y + dx * sin + dy * cos }
}

function renderFloating(f: FloatingSelection): HTMLCanvasElement {
  const cx = f.w / 2
  const cy = f.h / 2
  const cos = Math.cos(f.rotation)
  const sin = Math.sin(f.rotation)
  const corners = [
    { x: -cx, y: -cy },
    { x: cx, y: -cy },
    { x: cx, y: cy },
    { x: -cx, y: cy }
  ].map((p) => ({ x: p.x * cos - p.y * sin, y: p.x * sin + p.y * cos }))
  const minX = Math.min(...corners.map((p) => p.x))
  const minY = Math.min(...corners.map((p) => p.y))
  const maxX = Math.max(...corners.map((p) => p.x))
  const maxY = Math.max(...corners.map((p) => p.y))
  const out = createCanvas(Math.max(1, Math.ceil(maxX - minX)), Math.max(1, Math.ceil(maxY - minY)))
  const ctx = get2d(out)
  ctx.translate(-minX, -minY)
  ctx.translate(cx, cy)
  ctx.rotate(f.rotation)
  ctx.drawImage(f.canvas, -cx, -cy, f.w, f.h)
  return out
}

function drawFloatingOnto(ctx: CanvasRenderingContext2D, f: FloatingSelection, offsetX: number, offsetY: number): void {
  ctx.save()
  ctx.imageSmoothingEnabled = true
  ctx.translate(offsetX + f.x + f.w / 2, offsetY + f.y + f.h / 2)
  ctx.rotate(f.rotation)
  ctx.drawImage(f.canvas, -f.w / 2, -f.h / 2, f.w, f.h)
  ctx.restore()
}

function imagesEqual(a: ImageData, b: ImageData): boolean {
  if (a.width !== b.width || a.height !== b.height) return false
  const da = a.data
  const db = b.data
  for (let i = 0; i < da.length; i++) {
    if (da[i] !== db[i]) return false
  }
  return true
}

export const controller = new PaintController()

export function drawPencilLine(
  ctx: CanvasRenderingContext2D,
  color: string,
  from: Point,
  to: Point,
  width = 1
): void {
  ctx.save()
  ctx.fillStyle = color
  let x0 = Math.floor(from.x)
  let y0 = Math.floor(from.y)
  const x1 = Math.floor(to.x)
  const y1 = Math.floor(to.y)
  const dx = Math.abs(x1 - x0)
  const dy = Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1
  const sy = y0 < y1 ? 1 : -1
  let err = dx - dy
  const radius = Math.max(0, Math.floor(width / 2))
  while (true) {
    if (width <= 1) ctx.fillRect(x0, y0, 1, 1)
    else ctx.fillRect(x0 - radius, y0 - radius, width, width)
    if (x0 === x1 && y0 === y1) break
    const e2 = 2 * err
    if (e2 > -dy) {
      err -= dy
      x0 += sx
    }
    if (e2 < dx) {
      err += dx
      y0 += sy
    }
  }
  ctx.restore()
}

export function makeShapeOptions(
  primary: string,
  secondary: string,
  outline: boolean,
  fill: boolean,
  thickness: number,
  rightButton: boolean
): ShapeOptions {
  return {
    outlineColor: rightButton ? secondary : primary,
    fillColor: rightButton ? primary : secondary,
    outline,
    fill,
    thickness
  }
}

export type { HandleMode }
