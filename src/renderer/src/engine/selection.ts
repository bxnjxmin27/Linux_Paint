import { createCanvas, get2d } from './canvas'

export interface Bounds {
  x: number
  y: number
  w: number
  h: number
}

export interface Point {
  x: number
  y: number
}

export type Segment = [number, number, number, number]

export class Selection {
  width: number
  height: number
  mask: Uint8Array
  bounds: Bounds | null = null
  private segments: Segment[] | null = null

  constructor(width: number, height: number) {
    this.width = width
    this.height = height
    this.mask = new Uint8Array(width * height)
  }

  static fromRect(width: number, height: number, rect: Bounds): Selection {
    const sel = new Selection(width, height)
    sel.setRect(rect)
    return sel
  }

  clone(): Selection {
    const sel = new Selection(this.width, this.height)
    sel.mask.set(this.mask)
    sel.bounds = this.bounds ? { ...this.bounds } : null
    return sel
  }

  setRect(rect: Bounds): void {
    this.mask.fill(0)
    const x0 = Math.max(0, Math.floor(rect.x))
    const y0 = Math.max(0, Math.floor(rect.y))
    const x1 = Math.min(this.width, Math.ceil(rect.x + rect.w))
    const y1 = Math.min(this.height, Math.ceil(rect.y + rect.h))
    for (let y = y0; y < y1; y++) {
      const row = y * this.width
      this.mask.fill(1, row + x0, row + x1)
    }
    this.recompute()
  }

  setPolygon(points: Point[]): void {
    this.mask.fill(0)
    if (points.length < 3) {
      this.bounds = null
      this.segments = null
      return
    }
    const temp = createCanvas(this.width, this.height)
    const ctx = get2d(temp, true)
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.moveTo(points[0].x, points[0].y)
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y)
    ctx.closePath()
    ctx.fill()
    const data = ctx.getImageData(0, 0, this.width, this.height).data
    for (let i = 0, p = 3; i < this.mask.length; i++, p += 4) {
      this.mask[i] = data[p] > 0 ? 1 : 0
    }
    this.recompute()
  }

  setFromAlpha(canvas: HTMLCanvasElement, threshold = 1): void {
    this.mask.fill(0)
    const w = Math.min(this.width, canvas.width)
    const h = Math.min(this.height, canvas.height)
    const data = get2d(canvas, true).getImageData(0, 0, w, h).data
    for (let y = 0; y < h; y++) {
      const row = y * this.width
      const src = y * w * 4
      for (let x = 0; x < w; x++) {
        if (data[src + x * 4 + 3] >= threshold) this.mask[row + x] = 1
      }
    }
    this.recompute()
  }

  selectAll(): void {
    this.mask.fill(1)
    this.recompute()
  }

  clear(): void {
    this.mask.fill(0)
    this.bounds = null
    this.segments = null
  }

  invert(): void {
    for (let i = 0; i < this.mask.length; i++) this.mask[i] = this.mask[i] ? 0 : 1
    this.recompute()
  }

  contains(x: number, y: number): boolean {
    const px = Math.floor(x)
    const py = Math.floor(y)
    if (px < 0 || py < 0 || px >= this.width || py >= this.height) return false
    return this.mask[py * this.width + px] === 1
  }

  get isEmpty(): boolean {
    return this.bounds === null
  }

  recompute(): void {
    let minX = this.width
    let minY = this.height
    let maxX = -1
    let maxY = -1
    for (let y = 0; y < this.height; y++) {
      const row = y * this.width
      for (let x = 0; x < this.width; x++) {
        if (this.mask[row + x]) {
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (y < minY) minY = y
          if (y > maxY) maxY = y
        }
      }
    }
    this.bounds =
      maxX >= 0 ? { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 } : null
    this.segments = null
  }

  getSegments(): Segment[] {
    if (this.segments) return this.segments
    const out: Segment[] = []
    if (!this.bounds) {
      this.segments = out
      return out
    }
    const { x: bx, y: by, w: bw, h: bh } = this.bounds
    const at = (x: number, y: number): boolean =>
      x >= 0 && y >= 0 && x < this.width && y < this.height && this.mask[y * this.width + x] === 1
    for (let y = by; y < by + bh; y++) {
      for (let x = bx; x < bx + bw; x++) {
        if (!at(x, y)) continue
        if (!at(x, y - 1)) out.push([x, y, x + 1, y])
        if (!at(x, y + 1)) out.push([x, y + 1, x + 1, y + 1])
        if (!at(x - 1, y)) out.push([x, y, x, y + 1])
        if (!at(x + 1, y)) out.push([x + 1, y, x + 1, y + 1])
      }
    }
    this.segments = out
    return out
  }

  /** Copies the selected pixels of a canvas into a tight canvas. */
  extractCanvas(source: HTMLCanvasElement): { canvas: HTMLCanvasElement; bounds: Bounds } | null {
    if (!this.bounds) return null
    const { x, y, w, h } = this.bounds
    const out = createCanvas(w, h)
    const src = get2d(source, true).getImageData(0, 0, source.width, source.height).data
    const dstCtx = get2d(out, true)
    const img = dstCtx.createImageData(w, h)
    const d = img.data
    for (let yy = 0; yy < h; yy++) {
      for (let xx = 0; xx < w; xx++) {
        const sx = x + xx
        const sy = y + yy
        if (!this.contains(sx, sy)) continue
        const si = (sy * this.width + sx) * 4
        const di = (yy * w + xx) * 4
        d[di] = src[si]
        d[di + 1] = src[si + 1]
        d[di + 2] = src[si + 2]
        d[di + 3] = src[si + 3]
      }
    }
    dstCtx.putImageData(img, 0, 0)
    return { canvas: out, bounds: { x, y, w, h } }
  }

  clearRegion(ctx: CanvasRenderingContext2D): void {
    if (!this.bounds) return
    const { x, y, w, h } = this.bounds
    const img = ctx.getImageData(x, y, w, h)
    for (let yy = 0; yy < h; yy++) {
      for (let xx = 0; xx < w; xx++) {
        if (!this.contains(x + xx, y + yy)) continue
        const i = (yy * w + xx) * 4
        img.data[i] = 0
        img.data[i + 1] = 0
        img.data[i + 2] = 0
        img.data[i + 3] = 0
      }
    }
    ctx.putImageData(img, x, y)
  }
}
