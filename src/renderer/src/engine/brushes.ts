import type { BrushType } from './tools'
import { createCanvas, get2d, parseColor } from './canvas'

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const tipCache = new Map<string, HTMLCanvasElement>()

function makeTip(type: BrushType | 'eraser', size: number, color: string, variant: number): HTMLCanvasElement {
  const pad = Math.ceil(size * 0.8) + 6
  const dim = Math.max(4, Math.ceil(size + pad * 2))
  const canvas = createCanvas(dim, dim)
  const ctx = get2d(canvas)
  const c = dim / 2
  const radius = Math.max(0.5, size / 2)
  const rnd = mulberry32(1234 + Math.round(size * 7) + variant * 977 + type.length * 31)
  const rgba = parseColor(color)
  const solid = `rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, 1)`
  const alpha = (a: number): string => `rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, ${a})`
  const erase = type === 'eraser'
  const paintColor = (a: number): string => (erase ? `rgba(0,0,0,${a})` : alpha(a))

  switch (type) {
    case 'brush': {
      const g = ctx.createRadialGradient(c, c, radius * 0.25, c, c, radius)
      g.addColorStop(0, paintColor(1))
      g.addColorStop(0.82, paintColor(1))
      g.addColorStop(1, paintColor(0))
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(c, c, radius, 0, Math.PI * 2)
      ctx.fill()
      break
    }
    case 'calligraphy1': {
      ctx.save()
      ctx.translate(c, c)
      ctx.rotate(-Math.PI / 4)
      ctx.fillStyle = paintColor(1)
      ctx.beginPath()
      ctx.ellipse(0, 0, radius * 1.1, Math.max(0.8, radius * 0.32), 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
      break
    }
    case 'calligraphy2': {
      ctx.save()
      ctx.translate(c, c)
      ctx.rotate(Math.PI / 4)
      ctx.fillStyle = paintColor(1)
      ctx.beginPath()
      ctx.ellipse(0, 0, radius * 0.85, Math.max(0.8, radius * 0.5), 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
      break
    }
    case 'airbrush': {
      const count = Math.max(18, Math.round(size * size * 0.5))
      for (let i = 0; i < count; i++) {
        const ang = rnd() * Math.PI * 2
        const dist = Math.sqrt(rnd()) * radius * 1.25
        const rr = Math.max(0.35, radius * 0.035)
        ctx.fillStyle = paintColor(0.08 + rnd() * 0.12)
        ctx.beginPath()
        ctx.arc(c + Math.cos(ang) * dist, c + Math.sin(ang) * dist, rr, 0, Math.PI * 2)
        ctx.fill()
      }
      break
    }
    case 'oil': {
      const g = ctx.createRadialGradient(c, c, 0, c, c, radius)
      g.addColorStop(0, paintColor(0.9))
      g.addColorStop(0.75, paintColor(0.8))
      g.addColorStop(1, paintColor(0))
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(c, c, radius, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = paintColor(0.55)
      ctx.lineWidth = Math.max(0.6, radius * 0.07)
      for (let i = 0; i < Math.max(4, Math.round(size * 0.5)); i++) {
        const y = c + (rnd() - 0.5) * radius * 1.5
        ctx.beginPath()
        ctx.moveTo(c - radius * 0.8, y)
        ctx.lineTo(c + radius * 0.8, y + (rnd() - 0.5) * radius * 0.15)
        ctx.stroke()
      }
      break
    }
    case 'crayon': {
      const count = Math.max(45, Math.round(size * size * 0.9))
      for (let i = 0; i < count; i++) {
        const ang = rnd() * Math.PI * 2
        const dist = Math.sqrt(rnd()) * radius * 1.02
        const rr = Math.max(0.3, radius * (0.03 + rnd() * 0.055))
        ctx.fillStyle = paintColor(0.18 + rnd() * 0.3)
        ctx.beginPath()
        ctx.arc(c + Math.cos(ang) * dist, c + Math.sin(ang) * dist, rr, 0, Math.PI * 2)
        ctx.fill()
      }
      break
    }
    case 'marker': {
      ctx.save()
      ctx.translate(c, c)
      ctx.rotate(-Math.PI / 5)
      ctx.fillStyle = paintColor(1)
      const w = Math.max(1, size)
      const h = Math.max(1, size * 0.62)
      ctx.fillRect(-w / 2, -h / 2, w, h)
      ctx.restore()
      break
    }
    case 'pencil': {
      ctx.strokeStyle = paintColor(0.85)
      for (let i = 0; i < 16; i++) {
        const x = c + (rnd() - 0.5) * size * 0.7
        const y = c + (rnd() - 0.5) * size * 0.7
        ctx.lineWidth = Math.max(0.4, radius * 0.07)
        ctx.beginPath()
        ctx.moveTo(x - size * 0.18, y)
        ctx.lineTo(x + size * 0.18, y + (rnd() - 0.5) * 1.5)
        ctx.stroke()
      }
      break
    }
    case 'watercolor': {
      for (let i = 0; i < 7; i++) {
        const ang = rnd() * Math.PI * 2
        const dist = rnd() * radius * 0.5
        const rr = radius * (0.32 + rnd() * 0.55)
        const g = ctx.createRadialGradient(c + Math.cos(ang) * dist, c + Math.sin(ang) * dist, 0, c + Math.cos(ang) * dist, c + Math.sin(ang) * dist, rr)
        g.addColorStop(0, paintColor(0.1))
        g.addColorStop(0.7, paintColor(0.07))
        g.addColorStop(1, paintColor(0))
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(c + Math.cos(ang) * dist, c + Math.sin(ang) * dist, rr, 0, Math.PI * 2)
        ctx.fill()
      }
      break
    }
    case 'eraser': {
      ctx.fillStyle = 'rgba(0,0,0,1)'
      ctx.beginPath()
      ctx.arc(c, c, radius, 0, Math.PI * 2)
      ctx.fill()
      break
    }
  }

  if (size <= 1.5 && !erase && type !== 'airbrush' && type !== 'crayon' && type !== 'pencil') {
    ctx.clearRect(0, 0, dim, dim)
    ctx.fillStyle = solid
    ctx.fillRect(Math.floor(c), Math.floor(c), 1, 1)
  }

  return canvas
}

function getTip(type: BrushType | 'eraser', size: number, color: string, variant = 0): HTMLCanvasElement {
  const key = `${type}|${Math.round(size * 10) / 10}|${color}|${variant}`
  const hit = tipCache.get(key)
  if (hit) return hit
  if (tipCache.size > 120) tipCache.clear()
  const tip = makeTip(type, size, color, variant)
  tipCache.set(key, tip)
  return tip
}

export interface StrokePoint {
  x: number
  y: number
}

export interface BrushStrokeOptions {
  type: BrushType | 'eraser'
  size: number
  color: string
  erase?: boolean
  seed?: number
}

export function drawBrushDab(
  ctx: CanvasRenderingContext2D,
  point: StrokePoint,
  opts: BrushStrokeOptions,
  variant = 0
): void {
  const tip = getTip(opts.type, opts.size, opts.color, variant)
  ctx.save()
  if (opts.erase) ctx.globalCompositeOperation = 'destination-out'
  ctx.drawImage(tip, Math.round(point.x - tip.width / 2), Math.round(point.y - tip.height / 2))
  ctx.restore()
}

export function drawBrushSegment(
  ctx: CanvasRenderingContext2D,
  from: StrokePoint,
  to: StrokePoint,
  opts: BrushStrokeOptions
): void {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const dist = Math.hypot(dx, dy)
  const spacing = Math.max(0.7, opts.size * (opts.type === 'airbrush' ? 0.12 : 0.16))
  const steps = Math.max(1, Math.ceil(dist / spacing))
  const seed = opts.seed ?? 1
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const x = from.x + dx * t
    const y = from.y + dy * t
    const variant = (Math.floor(x * 0.11 + y * 0.07 + seed) >>> 0) % 3
    drawBrushDab(ctx, { x, y }, opts, variant)
  }
}

export function drawBrushPreview(
  canvas: HTMLCanvasElement,
  type: BrushType,
  color: string,
  size = 6
): void {
  const ctx = get2d(canvas)
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  const y = canvas.height / 2
  const steps = 42
  for (let i = 0; i < steps; i++) {
    const x = 6 + (i / (steps - 1)) * (canvas.width - 12)
    const yy = y + Math.sin(i * 0.28) * (canvas.height * 0.18)
    drawBrushDab(ctx, { x, y: yy }, { type, size, color, seed: 7 }, 0)
  }
}

export function clearTipCache(): void {
  tipCache.clear()
}
