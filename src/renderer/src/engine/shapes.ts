import type { Point } from './selection'
import type { ShapeType } from './tools'

export interface ShapeOptions {
  outlineColor: string
  fillColor: string
  outline: boolean
  fill: boolean
  thickness: number
}

export interface ShapeRect {
  x: number
  y: number
  w: number
  h: number
}

export function normalizeRect(a: Point, b: Point): ShapeRect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(b.x - a.x),
    h: Math.abs(b.y - a.y)
  }
}

function roundRectPath(ctx: CanvasRenderingContext2D, r: ShapeRect): void {
  const radius = Math.max(2, Math.min(r.w, r.h) * 0.16)
  const x = r.x
  const y = r.y
  const w = r.w
  const h = r.h
  const rr = Math.min(radius, w / 2, h / 2)
  ctx.moveTo(x + rr, y)
  ctx.lineTo(x + w - rr, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr)
  ctx.lineTo(x + w, y + h - rr)
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h)
  ctx.lineTo(x + rr, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr)
  ctx.lineTo(x, y + rr)
  ctx.quadraticCurveTo(x, y, x + rr, y)
  ctx.closePath()
}

function starPoints(cx: number, cy: number, outer: number, inner: number, points: number, rotation = -Math.PI / 2): Point[] {
  const out: Point[] = []
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner
    const angle = rotation + (i * Math.PI) / points
    out.push({ x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r })
  }
  return out
}

function polyPath(ctx: CanvasRenderingContext2D, points: Point[]): void {
  if (points.length === 0) return
  ctx.moveTo(points[0].x, points[0].y)
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y)
  ctx.closePath()
}

function paint(ctx: CanvasRenderingContext2D, opts: ShapeOptions, build: () => void, close = true): void {
  if (opts.fill) {
    ctx.save()
    ctx.beginPath()
    build()
    if (!close) ctx.closePath()
    ctx.fillStyle = opts.fillColor
    ctx.fill()
    ctx.restore()
  }
  if (opts.outline) {
    ctx.save()
    ctx.beginPath()
    build()
    if (!close) ctx.closePath()
    ctx.strokeStyle = opts.outlineColor
    ctx.lineWidth = Math.max(1, opts.thickness)
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.stroke()
    ctx.restore()
  }
}

export function drawShape(
  ctx: CanvasRenderingContext2D,
  type: ShapeType,
  a: Point,
  b: Point,
  opts: ShapeOptions,
  modifiers?: { c1?: Point; c2?: Point }
): void {
  const r = normalizeRect(a, b)
  const cx = r.x + r.w / 2
  const cy = r.y + r.h / 2

  switch (type) {
    case 'line':
      paint(ctx, { ...opts, fill: false }, () => {
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
      }, false)
      break

    case 'curve': {
      const c1 = modifiers?.c1 ?? { x: r.x + r.w / 3, y: r.y + r.h / 3 }
      const c2 = modifiers?.c2 ?? { x: r.x + (r.w * 2) / 3, y: r.y + (r.h * 2) / 3 }
      paint(ctx, { ...opts, fill: false }, () => {
        ctx.moveTo(a.x, a.y)
        ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, b.x, b.y)
      }, false)
      break
    }

    case 'rect':
      paint(ctx, { ...opts, fill: true }, () => ctx.rect(r.x, r.y, r.w, r.h))
      break

    case 'rounded-rect':
      paint(ctx, opts, () => roundRectPath(ctx, r))
      break

    case 'ellipse':
      paint(ctx, opts, () => ctx.ellipse(cx, cy, Math.max(0.5, r.w / 2), Math.max(0.5, r.h / 2), 0, 0, Math.PI * 2))
      break

    case 'triangle':
      polyPath(ctx, [
        { x: cx, y: r.y },
        { x: r.x + r.w, y: r.y + r.h },
        { x: r.x, y: r.y + r.h }
      ])
      if (opts.fill) {
        ctx.save()
        ctx.beginPath()
        polyPath(ctx, [
          { x: cx, y: r.y },
          { x: r.x + r.w, y: r.y + r.h },
          { x: r.x, y: r.y + r.h }
        ])
        ctx.fillStyle = opts.fillColor
        ctx.fill()
        ctx.restore()
      }
      if (opts.outline) {
        ctx.save()
        ctx.beginPath()
        polyPath(ctx, [
          { x: cx, y: r.y },
          { x: r.x + r.w, y: r.y + r.h },
          { x: r.x, y: r.y + r.h }
        ])
        ctx.strokeStyle = opts.outlineColor
        ctx.lineWidth = Math.max(1, opts.thickness)
        ctx.stroke()
        ctx.restore()
      }
      break

    case 'right-triangle':
      paint(ctx, opts, () => polyPath(ctx, [
        { x: r.x, y: r.y },
        { x: r.x, y: r.y + r.h },
        { x: r.x + r.w, y: r.y + r.h }
      ]))
      break

    case 'diamond':
      paint(ctx, opts, () => polyPath(ctx, [
        { x: cx, y: r.y },
        { x: r.x + r.w, y: cy },
        { x: cx, y: r.y + r.h },
        { x: r.x, y: cy }
      ]))
      break

    case 'pentagon':
    case 'hexagon': {
      const n = type === 'pentagon' ? 5 : 6
      const pts: Point[] = []
      for (let i = 0; i < n; i++) {
        const angle = -Math.PI / 2 + (i * Math.PI * 2) / n
        pts.push({ x: cx + Math.cos(angle) * (r.w / 2), y: cy + Math.sin(angle) * (r.h / 2) })
      }
      paint(ctx, opts, () => polyPath(ctx, pts))
      break
    }

    case 'arrow-right':
    case 'arrow-left':
    case 'arrow-up':
    case 'arrow-down': {
      const horizontal = type === 'arrow-right' || type === 'arrow-left'
      const flip = type === 'arrow-left' || type === 'arrow-up'
      const tail = horizontal ? r.h * 0.34 : r.w * 0.34
      const head = horizontal ? Math.min(r.w * 0.45, r.h * 0.55) : Math.min(r.h * 0.45, r.w * 0.55)
      let pts: Point[]
      if (horizontal) {
        const dir = flip ? -1 : 1
        const startX = flip ? r.x + r.w : r.x
        const endX = flip ? r.x : r.x + r.w
        const midY = cy
        pts = [
          { x: startX, y: midY - tail / 2 },
          { x: endX - dir * head, y: midY - tail / 2 },
          { x: endX - dir * head, y: r.y },
          { x: endX, y: midY },
          { x: endX - dir * head, y: r.y + r.h },
          { x: endX - dir * head, y: midY + tail / 2 },
          { x: startX, y: midY + tail / 2 }
        ]
      } else {
        const dir = flip ? -1 : 1
        const startY = flip ? r.y + r.h : r.y
        const endY = flip ? r.y : r.y + r.h
        const midX = cx
        pts = [
          { x: midX - tail / 2, y: startY },
          { x: midX - tail / 2, y: endY - dir * head },
          { x: r.x, y: endY - dir * head },
          { x: midX, y: endY },
          { x: r.x + r.w, y: endY - dir * head },
          { x: midX + tail / 2, y: endY - dir * head },
          { x: midX + tail / 2, y: startY }
        ]
      }
      paint(ctx, opts, () => polyPath(ctx, pts))
      break
    }

    case 'star-4':
    case 'star-5':
    case 'star-6': {
      const n = type === 'star-4' ? 4 : type === 'star-5' ? 5 : 6
      const pts = starPoints(cx, cy, Math.max(r.w, r.h) / 2, Math.max(r.w, r.h) / 4.6, n)
      paint(ctx, opts, () => polyPath(ctx, pts))
      break
    }

    case 'callout-rect': {
      const bodyH = r.h * 0.78
      const body: ShapeRect = { x: r.x, y: r.y, w: r.w, h: bodyH }
      if (opts.fill) {
        ctx.save()
        ctx.beginPath()
        roundRectPath(ctx, body)
        ctx.fillStyle = opts.fillColor
        ctx.fill()
        ctx.restore()
      }
      if (opts.outline) {
        ctx.save()
        ctx.beginPath()
        roundRectPath(ctx, body)
        ctx.strokeStyle = opts.outlineColor
        ctx.lineWidth = Math.max(1, opts.thickness)
        ctx.stroke()
        ctx.restore()
      }
      const tail: Point[] = [
        { x: r.x + r.w * 0.18, y: r.y + bodyH - 1 },
        { x: r.x + r.w * 0.28, y: r.y + bodyH - 1 },
        { x: r.x + r.w * 0.12, y: r.y + r.h }
      ]
      paint(ctx, opts, () => polyPath(ctx, tail))
      break
    }

    case 'callout-oval': {
      const bodyH = r.h * 0.78
      const body = { x: r.x, y: r.y, w: r.w, h: bodyH }
      const build = (): void => {
        ctx.ellipse(body.x + body.w / 2, body.y + body.h / 2, body.w / 2, body.h / 2, 0, 0, Math.PI * 2)
      }
      if (opts.fill) {
        ctx.save()
        ctx.beginPath()
        build()
        ctx.fillStyle = opts.fillColor
        ctx.fill()
        ctx.restore()
      }
      if (opts.outline) {
        ctx.save()
        ctx.beginPath()
        build()
        ctx.strokeStyle = opts.outlineColor
        ctx.lineWidth = Math.max(1, opts.thickness)
        ctx.stroke()
        ctx.restore()
      }
      paint(ctx, opts, () => polyPath(ctx, [
        { x: r.x + r.w * 0.2, y: r.y + bodyH - 2 },
        { x: r.x + r.w * 0.31, y: r.y + bodyH - 2 },
        { x: r.x + r.w * 0.13, y: r.y + r.h }
      ]))
      break
    }

    case 'callout-cloud': {
      const bodyH = r.h * 0.78
      const by = r.y
      const build = (): void => {
        ctx.moveTo(r.x + r.w * 0.22, by + bodyH * 0.76)
        ctx.bezierCurveTo(r.x + r.w * 0.05, by + bodyH * 0.76, r.x + r.w * 0.02, by + bodyH * 0.42, r.x + r.w * 0.18, by + bodyH * 0.38)
        ctx.bezierCurveTo(r.x + r.w * 0.14, by + bodyH * 0.12, r.x + r.w * 0.36, by + bodyH * 0.02, r.x + r.w * 0.46, by + bodyH * 0.16)
        ctx.bezierCurveTo(r.x + r.w * 0.55, by + bodyH * 0.0, r.x + r.w * 0.76, by + bodyH * 0.05, r.x + r.w * 0.76, by + bodyH * 0.25)
        ctx.bezierCurveTo(r.x + r.w * 0.96, by + bodyH * 0.24, r.x + r.w * 0.99, by + bodyH * 0.55, r.x + r.w * 0.84, by + bodyH * 0.68)
        ctx.bezierCurveTo(r.x + r.w * 0.88, by + bodyH * 0.9, r.x + r.w * 0.62, by + bodyH * 0.96, r.x + r.w * 0.52, by + bodyH * 0.82)
        ctx.bezierCurveTo(r.x + r.w * 0.38, by + bodyH * 0.95, r.x + r.w * 0.24, by + bodyH * 0.9, r.x + r.w * 0.22, by + bodyH * 0.76)
      }
      if (opts.fill) {
        ctx.save()
        ctx.beginPath()
        build()
        ctx.fillStyle = opts.fillColor
        ctx.fill()
        ctx.restore()
      }
      if (opts.outline) {
        ctx.save()
        ctx.beginPath()
        build()
        ctx.strokeStyle = opts.outlineColor
        ctx.lineWidth = Math.max(1, opts.thickness)
        ctx.stroke()
        ctx.restore()
      }
      paint(ctx, opts, () => {
        ctx.moveTo(r.x + r.w * 0.28, r.y + bodyH * 0.8)
        ctx.lineTo(r.x + r.w * 0.38, r.y + bodyH * 0.8)
        ctx.lineTo(r.x + r.w * 0.18, r.y + r.h)
        ctx.closePath()
      })
      break
    }

    case 'heart': {
      const build = (): void => {
        ctx.moveTo(cx, r.y + r.h * 0.95)
        ctx.bezierCurveTo(r.x - r.w * 0.05, r.y + r.h * 0.55, r.x + r.w * 0.08, r.y + r.h * 0.05, cx, r.y + r.h * 0.28)
        ctx.bezierCurveTo(r.x + r.w * 0.92, r.y + r.h * 0.05, r.x + r.w * 1.05, r.y + r.h * 0.55, cx, r.y + r.h * 0.95)
        ctx.closePath()
      }
      paint(ctx, opts, build)
      break
    }

    case 'lightning':
      paint(ctx, opts, () => polyPath(ctx, [
        { x: r.x + r.w * 0.56, y: r.y },
        { x: r.x + r.w * 0.2, y: r.y + r.h * 0.58 },
        { x: r.x + r.w * 0.47, y: r.y + r.h * 0.58 },
        { x: r.x + r.w * 0.35, y: r.y + r.h },
        { x: r.x + r.w * 0.82, y: r.y + r.h * 0.4 },
        { x: r.x + r.w * 0.54, y: r.y + r.h * 0.4 }
      ]))
      break
  }
}

export function drawPolygonShape(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  opts: ShapeOptions,
  close = true
): void {
  if (points.length < 2) return
  paint(ctx, opts, () => {
    ctx.moveTo(points[0].x, points[0].y)
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y)
    if (close) ctx.closePath()
  }, close)
}

export function drawCurveShape(
  ctx: CanvasRenderingContext2D,
  a: Point,
  b: Point,
  c1: Point,
  c2: Point,
  opts: ShapeOptions
): void {
  paint(ctx, { ...opts, fill: false }, () => {
    ctx.moveTo(a.x, a.y)
    ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, b.x, b.y)
  }, false)
}

/** Small preview used by the shape gallery. */
export function drawShapeThumb(
  ctx: CanvasRenderingContext2D,
  type: ShapeType,
  width: number,
  height: number,
  color: string
): void {
  ctx.clearRect(0, 0, width, height)
  const pad = 3
  const r = { x: pad, y: pad, w: width - pad * 2, h: height - pad * 2 }
  const opts: ShapeOptions = {
    outlineColor: color,
    fillColor: color,
    outline: true,
    fill: false,
    thickness: 1.2
  }
  if (type === 'line') drawShape(ctx, 'line', { x: r.x, y: r.y + r.h }, { x: r.x + r.w, y: r.y }, opts)
  else if (type === 'curve') {
    drawCurveShape(ctx, { x: r.x, y: r.y + r.h }, { x: r.x + r.w, y: r.y + r.h }, { x: r.x + r.w * 0.3, y: r.y }, { x: r.x + r.w * 0.7, y: r.y + r.h * 0.3 }, opts)
  } else if (type === 'polygon') {
    drawPolygonShape(ctx, [
      { x: r.x + 1, y: r.y + r.h * 0.6 },
      { x: r.x + r.w * 0.35, y: r.y + 1 },
      { x: r.x + r.w * 0.7, y: r.y + r.h * 0.3 },
      { x: r.x + r.w - 1, y: r.y + r.h * 0.8 }
    ], opts)
  } else {
    drawShape(ctx, type, { x: r.x, y: r.y }, { x: r.x + r.w, y: r.y + r.h }, opts)
  }
}
