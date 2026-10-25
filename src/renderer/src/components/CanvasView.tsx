import { useCallback, useEffect, useRef, useState } from 'react'
import { useUI } from '../state/store'
import { useCursor } from '../state/cursor'
import { useText } from '../state/text'
import { controller, drawPencilLine, makeShapeOptions } from '../engine/controller'
import { drawBrushDab, drawBrushSegment } from '../engine/brushes'
import { drawShape, normalizeRect, drawCurveShape, drawPolygonShape } from '../engine/shapes'
import { getCheckerCanvas, get2d } from '../engine/canvas'
import type { Point } from '../engine/selection'
import type { HandleMode } from '../engine/controller'

type Interaction =
  | { kind: 'paint'; last: Point; color: string; brush: boolean; erase: boolean }
  | { kind: 'shape'; start: Point; end: Point; right: boolean }
  | { kind: 'selection-rect'; start: Point; end: Point }
  | { kind: 'selection-lasso'; points: Point[] }
  | { kind: 'text-box'; start: Point; end: Point }
  | { kind: 'pan'; lastX: number; lastY: number }
  | { kind: 'floating'; }
  | { kind: 'curve-adjust'; point: Point }
  | null

interface CurveState {
  a: Point
  b: Point
  c1: Point
  c2: Point
  stage: 1 | 2
}

function pointInFloating(p: Point): boolean {
  const f = controller.floating
  if (!f) return false
  const cx = f.x + f.w / 2
  const cy = f.y + f.h / 2
  const cos = Math.cos(-f.rotation)
  const sin = Math.sin(-f.rotation)
  const dx = p.x - cx
  const dy = p.y - cy
  const x = dx * cos - dy * sin + f.w / 2
  const y = dx * sin + dy * cos + f.h / 2
  return x >= 0 && y >= 0 && x <= f.w && y <= f.h
}

function applyShift(start: Point, end: Point, shift: boolean, shape: string): Point {
  if (!shift) return end
  const dx = end.x - start.x
  const dy = end.y - start.y
  if (shape === 'line') {
    const angle = Math.atan2(dy, dx)
    const snapped = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4)
    const len = Math.hypot(dx, dy)
    return { x: start.x + Math.cos(snapped) * len, y: start.y + Math.sin(snapped) * len }
  }
  const size = Math.max(Math.abs(dx), Math.abs(dy))
  return {
    x: start.x + Math.sign(dx || 1) * size,
    y: start.y + Math.sign(dy || 1) * size
  }
}

export function CanvasView(): React.ReactElement {
  const view = useUI((s) => s.view)
  const docVersion = useUI((s) => s.docVersion)
  const tool = useUI((s) => s.tool)
  const brushSize = useUI((s) => s.brushSize)
  const shapeType = useUI((s) => s.shapeType)
  const shapeOutline = useUI((s) => s.shapeOutline)
  const shapeFill = useUI((s) => s.shapeFill)
  const shapeThickness = useUI((s) => s.shapeThickness)
  const color1 = useUI((s) => s.color1)
  const color2 = useUI((s) => s.color2)
  const selection = useUI((s) => s.selection)
  const showGrid = useUI((s) => s.showGrid)
  const showRulers = useUI((s) => s.showRulers)
  const textSession = useText((s) => s.session)
  const textStyle = useText((s) => s.style)
  const setCursor = useCursor((s) => s.setCursor)

  const viewportRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const interactionRef = useRef<Interaction>(null)
  const hoverRef = useRef({ x: 0, y: 0, inside: false })
  const spaceRef = useRef(false)
  const rafRef = useRef<number | null>(null)
  const curveRef = useRef<CurveState | null>(null)
  const polygonRef = useRef<Point[] | null>(null)
  const [cursorMode, setCursorMode] = useState<string>('default')

  const screenToDoc = useCallback(
    (sx: number, sy: number): Point => {
      const v = useUI.getState().view
      return { x: (sx - v.offsetX) / v.zoom, y: (sy - v.offsetY) / v.zoom }
    },
    []
  )

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const viewport = viewportRef.current
    if (!canvas || !viewport) return
    const state = useUI.getState()
    const toolNow = state.tool
    const dpr = Math.min(2.5, window.devicePixelRatio || 1)
    const cw = viewport.clientWidth
    const ch = viewport.clientHeight
    if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) {
      canvas.width = Math.round(cw * dpr)
      canvas.height = Math.round(ch * dpr)
    }
    const ctx = get2d(canvas)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, cw, ch)
    ctx.fillStyle = '#eeeeee'
    ctx.fillRect(0, 0, cw, ch)

    const v = state.view
    const pageX = v.offsetX
    const pageY = v.offsetY
    const pageW = controller.doc.width * v.zoom
    const pageH = controller.doc.height * v.zoom

    // page shadow
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.22)'
    ctx.shadowBlur = 10
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 2
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(pageX, pageY, pageW, pageH)
    ctx.restore()

    ctx.save()
    ctx.beginPath()
    ctx.rect(pageX, pageY, pageW, pageH)
    ctx.clip()

    // checkerboard
    const pattern = ctx.createPattern(getCheckerCanvas(), 'repeat')
    if (pattern) {
      ctx.fillStyle = pattern
      ctx.fillRect(pageX, pageY, pageW, pageH)
    }

    // layers
    ctx.imageSmoothingEnabled = v.zoom < 1
    for (const layer of controller.doc.layers) {
      if (!layer.visible) continue
      ctx.drawImage(layer.canvas, pageX, pageY, pageW, pageH)
    }

    // floating selection
    controller.drawFloating(ctx, pageX, pageY, v.zoom)

    // pixel grid
    if (state.showGrid && v.zoom >= 4) {
      const startX = Math.max(0, Math.floor((0 - pageX) / v.zoom))
      const endX = Math.min(controller.doc.width, Math.ceil((cw - pageX) / v.zoom))
      const startY = Math.max(0, Math.floor((0 - pageY) / v.zoom))
      const endY = Math.min(controller.doc.height, Math.ceil((ch - pageY) / v.zoom))
      ctx.save()
      ctx.strokeStyle = 'rgba(0,0,0,0.13)'
      ctx.lineWidth = 1
      ctx.beginPath()
      const step = v.zoom >= 8 ? 1 : 8
      for (let x = Math.floor(startX / step) * step; x <= endX; x += step) {
        const sx = Math.round(pageX + x * v.zoom) + 0.5
        ctx.moveTo(sx, pageY)
        ctx.lineTo(sx, pageY + pageH)
      }
      for (let y = Math.floor(startY / step) * step; y <= endY; y += step) {
        const sy = Math.round(pageY + y * v.zoom) + 0.5
        ctx.moveTo(pageX, sy)
        ctx.lineTo(pageX + pageW, sy)
      }
      ctx.stroke()
      ctx.restore()
    }

    ctx.restore()

    // page border
    ctx.strokeStyle = '#c9c9c9'
    ctx.lineWidth = 1
    ctx.strokeRect(Math.round(pageX) + 0.5, Math.round(pageY) + 0.5, Math.round(pageW) - 1, Math.round(pageH) - 1)

    // selection / floating outline and handles
    const time = performance.now()
    if (controller.floating) {
      drawFloatingAnts(ctx, pageX, pageY, v.zoom, time)
      if (toolNow === 'select-rect' || toolNow === 'select-free') drawHandles(ctx, pageX, pageY, v.zoom, true)
    } else if (controller.selection && !controller.selection.isEmpty) {
      drawSelectionAnts(ctx, pageX, pageY, v.zoom, time)
      if (toolNow === 'select-rect' || toolNow === 'select-free') drawHandles(ctx, pageX, pageY, v.zoom, false)
    }

    // transient selection preview
    const inter = interactionRef.current
    if (inter && inter.kind === 'selection-rect') {
      const a = inter.start
      const b = inter.end
      ctx.save()
      ctx.setLineDash([4, 4])
      ctx.strokeStyle = '#111'
      ctx.lineWidth = 1
      ctx.strokeRect(
        pageX + Math.min(a.x, b.x) * v.zoom + 0.5,
        pageY + Math.min(a.y, b.y) * v.zoom + 0.5,
        Math.abs(b.x - a.x) * v.zoom,
        Math.abs(b.y - a.y) * v.zoom
      )
      ctx.restore()
    }
    if (inter && inter.kind === 'selection-lasso' && inter.points.length > 1) {
      ctx.save()
      ctx.setLineDash([4, 4])
      ctx.strokeStyle = '#111'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(pageX + inter.points[0].x * v.zoom, pageY + inter.points[0].y * v.zoom)
      for (const p of inter.points) ctx.lineTo(pageX + p.x * v.zoom, pageY + p.y * v.zoom)
      ctx.stroke()
      ctx.restore()
    }

    // shape preview
    if (inter && inter.kind === 'shape') {
      const opts = makeShapeOptions(
        state.color1,
        state.color2,
        state.shapeOutline,
        state.shapeFill,
        state.shapeThickness,
        inter.right
      )
      ctx.save()
      ctx.translate(pageX, pageY)
      ctx.scale(v.zoom, v.zoom)
      ctx.globalAlpha = 0.9
      drawShape(ctx, state.shapeType, inter.start, inter.end, opts)
      ctx.restore()
    }

    if (curveRef.current) {
      ctx.save()
      ctx.translate(pageX, pageY)
      ctx.scale(v.zoom, v.zoom)
      const c = curveRef.current
      drawCurveShape(
        ctx,
        c.a,
        c.b,
        c.c1,
        c.c2,
        makeShapeOptions(state.color1, state.color2, state.shapeOutline, state.shapeFill, state.shapeThickness, false)
      )
      ctx.restore()
    }

    if (polygonRef.current && polygonRef.current.length > 0) {
      ctx.save()
      ctx.translate(pageX, pageY)
      ctx.scale(v.zoom, v.zoom)
      const pts = polygonRef.current
      const p = hoverRef.current
      const preview = [...pts, screenToDoc(p.x, p.y)]
      drawPolygonShape(
        ctx,
        preview,
        makeShapeOptions(state.color1, state.color2, state.shapeOutline, state.shapeFill, state.shapeThickness, false),
        false
      )
      ctx.restore()
    }

    // text box preview while dragging
    if (inter && inter.kind === 'text-box') {
      const a = inter.start
      const b = inter.end
      ctx.save()
      ctx.setLineDash([4, 3])
      ctx.strokeStyle = '#555'
      ctx.lineWidth = 1
      ctx.strokeRect(
        pageX + Math.min(a.x, b.x) * v.zoom + 0.5,
        pageY + Math.min(a.y, b.y) * v.zoom + 0.5,
        Math.abs(b.x - a.x) * v.zoom,
        Math.abs(b.y - a.y) * v.zoom
      )
      ctx.restore()
    }

    // brush cursor
    const hover = hoverRef.current
    if (hover.inside && !textSession) {
      const sx = hover.x
      const sy = hover.y
      if (toolNow === 'brush' || toolNow === 'eraser') {
        const r = Math.max(1.5, (state.brushSize * v.zoom) / 2)
        ctx.save()
        ctx.lineWidth = 2
        ctx.strokeStyle = 'rgba(255,255,255,0.9)'
        ctx.beginPath()
        ctx.arc(sx, sy, r, 0, Math.PI * 2)
        ctx.stroke()
        ctx.lineWidth = 1
        ctx.strokeStyle = 'rgba(0,0,0,0.9)'
        ctx.beginPath()
        ctx.arc(sx, sy, r, 0, Math.PI * 2)
        ctx.stroke()
        ctx.restore()
      } else if (toolNow === 'pencil' || toolNow === 'fill' || toolNow === 'picker' || toolNow === 'shape') {
        ctx.save()
        ctx.strokeStyle = 'rgba(0,0,0,0.78)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(sx - 6, sy + 0.5)
        ctx.lineTo(sx + 6, sy + 0.5)
        ctx.moveTo(sx + 0.5, sy - 6)
        ctx.lineTo(sx + 0.5, sy + 6)
        ctx.stroke()
        ctx.restore()
      }
    }
  }, [screenToDoc, textSession])

  const scheduleDraw = useCallback(() => {
    if (rafRef.current !== null) return
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null
      draw()
    })
  }, [draw])

  useEffect(() => {
    controller.repaint = scheduleDraw
    return () => {
      if (controller.repaint === scheduleDraw) controller.repaint = null
    }
  }, [scheduleDraw])

  useEffect(() => {
    scheduleDraw()
  }, [view, docVersion, selection, showGrid, tool, brushSize, shapeType, shapeOutline, shapeFill, shapeThickness, color1, color2, textSession, textStyle, scheduleDraw])

  useEffect(() => {
    if (tool !== 'shape') {
      curveRef.current = null
      polygonRef.current = null
      scheduleDraw()
    } else {
      if (shapeType !== 'curve') curveRef.current = null
      if (shapeType !== 'polygon') polygonRef.current = null
    }
  }, [tool, shapeType, scheduleDraw])

  useEffect(() => {
    if (!controller.selection && !controller.floating) return
    const id = window.setInterval(scheduleDraw, 90)
    return () => window.clearInterval(id)
  }, [selection, scheduleDraw])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0].contentRect
      useUI.getState().setViewportSize(Math.max(1, Math.floor(rect.width)), Math.max(1, Math.floor(rect.height)))
    })
    ro.observe(viewport)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const down = (e: KeyboardEvent): void => {
      if (e.code === 'Space' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        spaceRef.current = true
        setCursorMode('grab')
      }
      if (e.key === 'Escape') {
        if (curveRef.current) {
          curveRef.current = null
          scheduleDraw()
        }
        if (polygonRef.current) {
          polygonRef.current = null
          scheduleDraw()
        }
      }
      if (e.key === 'Enter' && polygonRef.current && polygonRef.current.length >= 3) {
        const opts = makeShapeOptions(
          useUI.getState().color1,
          useUI.getState().color2,
          useUI.getState().shapeOutline,
          useUI.getState().shapeFill,
          useUI.getState().shapeThickness,
          false
        )
        controller.drawPolygonFinal(polygonRef.current, opts)
        polygonRef.current = null
        scheduleDraw()
      }
    }
    const up = (e: KeyboardEvent): void => {
      if (e.code === 'Space') {
        spaceRef.current = false
        setCursorMode('default')
      }
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [scheduleDraw])

  useEffect(() => {
    if (textSession) {
      requestAnimationFrame(() => textareaRef.current?.focus())
    }
  }, [textSession])

  const getScreen = (e: { clientX: number; clientY: number }): { sx: number; sy: number } => {
    const rect = viewportRef.current!.getBoundingClientRect()
    return { sx: e.clientX - rect.left, sy: e.clientY - rect.top }
  }

  const handleHit = (docPoint: Point): HandleMode | null => {
    const v = useUI.getState().view
    const points = controller.floating ? controller.getFloatingHandlePoints() : selectionHandlePoints()
    const tolerance = 8 / v.zoom
    for (const p of points) {
      if (Math.hypot(docPoint.x - p.x, docPoint.y - p.y) <= tolerance) return p.mode
    }
    return null
  }

  const selectionHandlePoints = (): Array<{ mode: HandleMode; x: number; y: number }> => {
    const sel = controller.selection
    if (!sel || !sel.bounds) return []
    const b = sel.bounds
    const v = useUI.getState().view
    return [
      { mode: 'nw', x: b.x, y: b.y },
      { mode: 'n', x: b.x + b.w / 2, y: b.y },
      { mode: 'ne', x: b.x + b.w, y: b.y },
      { mode: 'e', x: b.x + b.w, y: b.y + b.h / 2 },
      { mode: 'se', x: b.x + b.w, y: b.y + b.h },
      { mode: 's', x: b.x + b.w / 2, y: b.y + b.h },
      { mode: 'sw', x: b.x, y: b.y + b.h },
      { mode: 'w', x: b.x, y: b.y + b.h / 2 },
      { mode: 'rotate', x: b.x + b.w / 2, y: b.y - 26 / v.zoom }
    ]
  }

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (e.button !== 0 && e.button !== 1 && e.button !== 2) return
    const { sx, sy } = getScreen(e)
    const point = screenToDoc(sx, sy)
    const state = useUI.getState()
    hoverRef.current = { x: sx, y: sy, inside: true }
    viewportRef.current?.focus()
    e.preventDefault()

    if (e.button === 1 || spaceRef.current) {
      interactionRef.current = { kind: 'pan', lastX: e.clientX, lastY: e.clientY }
      viewportRef.current?.setPointerCapture(e.pointerId)
      setCursorMode('grabbing')
      return
    }

    const right = e.button === 2
    viewportRef.current?.setPointerCapture(e.pointerId)

    if (state.tool === 'pencil') {
      const color = right ? state.color2 : state.color1
      controller.beginPixelEdit()
      drawPencilLine(controller.doc.activeLayer.ctx, color, point, point, 1)
      interactionRef.current = { kind: 'paint', last: point, color, brush: false, erase: false }
      scheduleDraw()
      return
    }

    if (state.tool === 'brush' || state.tool === 'eraser') {
      const erase = state.tool === 'eraser'
      const color = right ? state.color2 : state.color1
      controller.beginPixelEdit()
      drawBrushDab(controller.doc.activeLayer.ctx, point, {
        type: erase ? 'eraser' : state.brushType,
        size: state.brushSize,
        color,
        erase,
        seed: Math.random() * 1000
      })
      interactionRef.current = { kind: 'paint', last: point, color, brush: true, erase }
      scheduleDraw()
      return
    }

    if (state.tool === 'fill') {
      controller.floodFill(point.x, point.y, right ? state.color2 : state.color1)
      return
    }

    if (state.tool === 'picker') {
      controller.pickColor(point.x, point.y, right)
      return
    }

    if (state.tool === 'magnifier') {
      const factor = right ? 1 / 1.6 : 1.6
      const current = useUI.getState().view
      state.view // keep linter quiet
      useUI.getState().zoomAt(current.zoom * factor, sx, sy)
      return
    }

    if (state.tool === 'select-rect' || state.tool === 'select-free') {
      if (curveRef.current) curveRef.current = null
      if (polygonRef.current) polygonRef.current = null
      const floating = controller.floating
      const sel = controller.selection
      const inside = floating ? pointInFloating(point) : sel?.contains(point.x, point.y) ?? false
      if (floating || (sel && !sel.isEmpty)) {
        const handle = handleHit(point)
        if (handle) {
          if (controller.startFloatingDrag(handle, point)) {
            interactionRef.current = { kind: 'floating' }
            scheduleDraw()
            return
          }
        }
        if (inside && controller.startFloatingDrag('move', point)) {
          interactionRef.current = { kind: 'floating' }
          scheduleDraw()
          return
        }
      }
      if (controller.floating) controller.commitFloating()
      controller.selection = null
      useUI.setState({ selection: null })
      if (state.tool === 'select-rect') {
        interactionRef.current = { kind: 'selection-rect', start: point, end: point }
      } else {
        interactionRef.current = { kind: 'selection-lasso', points: [point] }
      }
      scheduleDraw()
      return
    }

    if (state.tool === 'shape') {
      if (state.shapeType === 'curve' && curveRef.current) {
        interactionRef.current = { kind: 'curve-adjust', point }
        scheduleDraw()
        return
      }
      if (state.shapeType === 'polygon') {
        const pts = polygonRef.current ?? []
        pts.push(point)
        polygonRef.current = pts
        scheduleDraw()
        return
      }
      interactionRef.current = { kind: 'shape', start: point, end: point, right }
      scheduleDraw()
      return
    }

    if (state.tool === 'text') {
      if (useText.getState().session) {
        const session = useText.getState().session
        if (session) controller.commitText(session, useText.getState().style)
      }
      interactionRef.current = { kind: 'text-box', start: point, end: point }
      scheduleDraw()
    }
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>): void => {
    const { sx, sy } = getScreen(e)
    const point = screenToDoc(sx, sy)
    hoverRef.current = { x: sx, y: sy, inside: true }
    setCursor(point.x, point.y, true)
    const inter = interactionRef.current
    const state = useUI.getState()

    if (inter?.kind === 'pan') {
      const dx = e.clientX - inter.lastX
      const dy = e.clientY - inter.lastY
      inter.lastX = e.clientX
      inter.lastY = e.clientY
      useUI.getState().panBy(dx, dy)
      return
    }

    if (inter?.kind === 'paint') {
      if (inter.brush) {
        drawBrushSegment(controller.doc.activeLayer.ctx, inter.last, point, {
          type: inter.erase ? 'eraser' : state.brushType,
          size: state.brushSize,
          color: inter.color,
          erase: inter.erase,
          seed: inter.last.x + inter.last.y
        })
      } else {
        drawPencilLine(controller.doc.activeLayer.ctx, inter.color, inter.last, point, 1)
      }
      inter.last = point
      scheduleDraw()
      return
    }

    if (inter?.kind === 'shape') {
      inter.end = applyShift(inter.start, point, e.shiftKey, state.shapeType)
      scheduleDraw()
      return
    }

    if (inter?.kind === 'selection-rect') {
      inter.end = point
      scheduleDraw()
      return
    }

    if (inter?.kind === 'selection-lasso') {
      const last = inter.points[inter.points.length - 1]
      if (Math.hypot(point.x - last.x, point.y - last.y) >= 1.2) {
        inter.points.push(point)
        scheduleDraw()
      }
      return
    }

    if (inter?.kind === 'floating') {
      controller.dragFloating(point, e.shiftKey)
      return
    }

    if (inter?.kind === 'curve-adjust') {
      const c = curveRef.current
      if (c) {
        if (c.stage === 1) c.c1 = point
        else c.c2 = point
        scheduleDraw()
      }
      return
    }

    if (inter?.kind === 'text-box') {
      inter.end = point
      scheduleDraw()
      return
    }

    scheduleDraw()
  }

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>): void => {
    const { sx, sy } = getScreen(e)
    const point = screenToDoc(sx, sy)
    const inter = interactionRef.current
    const state = useUI.getState()
    interactionRef.current = null
    if (viewportRef.current?.hasPointerCapture(e.pointerId)) {
      viewportRef.current.releasePointerCapture(e.pointerId)
    }
    if (!inter) return

    if (inter.kind === 'paint') {
      controller.endPixelEdit(inter.erase ? 'Radieren' : inter.brush ? 'Pinsel' : 'Bleistift')
      scheduleDraw()
      return
    }

    if (inter.kind === 'shape') {
      const end = applyShift(inter.start, point, e.shiftKey, state.shapeType)
      if (state.shapeType === 'curve') {
        curveRef.current = {
          a: inter.start,
          b: end,
          c1: { x: inter.start.x + (end.x - inter.start.x) / 3, y: inter.start.y + (end.y - inter.start.y) / 3 },
          c2: { x: inter.start.x + ((end.x - inter.start.x) * 2) / 3, y: inter.start.y + ((end.y - inter.start.y) * 2) / 3 },
          stage: 1
        }
        scheduleDraw()
        return
      }
      if (Math.abs(end.x - inter.start.x) < 1 && Math.abs(end.y - inter.start.y) < 1) return
      const opts = makeShapeOptions(state.color1, state.color2, state.shapeOutline, state.shapeFill, state.shapeThickness, inter.right)
      controller.drawShapeFinal(state.shapeType, inter.start, end, opts)
      scheduleDraw()
      return
    }

    if (inter.kind === 'curve-adjust') {
      const c = curveRef.current
      if (c) {
        if (c.stage === 1) {
          c.stage = 2
          scheduleDraw()
        } else {
          controller.drawCurveFinal(
            c.a,
            c.b,
            c.c1,
            c.c2,
            makeShapeOptions(state.color1, state.color2, state.shapeOutline, state.shapeFill, state.shapeThickness, false)
          )
          curveRef.current = null
          scheduleDraw()
        }
      }
      return
    }

    if (inter.kind === 'selection-rect') {
      const rect = normalizeRect(inter.start, point)
      if (rect.w >= 1 && rect.h >= 1) controller.setSelectionRect(rect)
      else {
        controller.selection = null
        useUI.setState({ selection: null })
      }
      scheduleDraw()
      return
    }

    if (inter.kind === 'selection-lasso') {
      if (inter.points.length >= 3) controller.setSelectionPolygon(inter.points)
      scheduleDraw()
      return
    }

    if (inter.kind === 'floating') {
      controller.endFloatingDrag()
      scheduleDraw()
      return
    }

    if (inter.kind === 'text-box') {
      const rect = normalizeRect(inter.start, point)
      const fontPx = (useText.getState().style.size * 96) / 72
      const box = {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        w: Math.max(24, Math.round(rect.w > 4 ? rect.w : 220)),
        h: Math.max(Math.round(fontPx * 1.4), Math.round(rect.h > 4 ? rect.h : fontPx * 1.4))
      }
      useText.getState().start({ ...box, text: '' })
      scheduleDraw()
      return
    }

    if (inter.kind === 'pan') {
      setCursorMode('default')
    }
  }

  const onDoubleClick = (): void => {
    if (polygonRef.current && polygonRef.current.length >= 3) {
      const state = useUI.getState()
      controller.drawPolygonFinal(
        polygonRef.current,
        makeShapeOptions(state.color1, state.color2, state.shapeOutline, state.shapeFill, state.shapeThickness, false)
      )
      polygonRef.current = null
      scheduleDraw()
    }
  }

  const onWheel = (e: React.WheelEvent<HTMLDivElement>): void => {
    const { sx, sy } = getScreen(e)
    if (e.ctrlKey || e.metaKey) {
      const viewNow = useUI.getState().view
      const factor = Math.exp(-e.deltaY * 0.0025)
      useUI.getState().zoomAt(viewNow.zoom * factor, sx, sy)
    } else {
      const dx = e.shiftKey ? e.deltaY : e.deltaX
      const dy = e.shiftKey ? 0 : e.deltaY
      useUI.getState().panBy(-dx, -dy)
    }
  }

  const onContextMenu = (e: React.MouseEvent): void => {
    e.preventDefault()
  }

  const textRect = textSession
    ? {
        left: view.offsetX + textSession.x * view.zoom,
        top: view.offsetY + textSession.y * view.zoom,
        width: Math.max(8, textSession.w * view.zoom),
        height: Math.max(8, textSession.h * view.zoom)
      }
    : null

  const fontPx = (textStyle.size * 96) / 72 * view.zoom

  return (
    <div className={`canvas-shell${showRulers ? '' : ' no-rulers'}`}>
      {showRulers ? (
        <>
          <div className="ruler-corner" />
          <div className="ruler-top-wrap">
            <RulerCanvas orientation="horizontal" width={view.vw} height={20} />
          </div>
          <div className="ruler-left-wrap">
            <RulerCanvas orientation="vertical" width={20} height={view.vh} />
          </div>
        </>
      ) : null}
      <div
        ref={viewportRef}
        className={`viewport${cursorMode === 'grabbing' ? ' panning' : ''}`}
        style={{
          cursor:
            cursorMode === 'grabbing'
              ? 'grabbing'
              : tool === 'brush' || tool === 'eraser'
                ? 'none'
                : tool === 'magnifier'
                  ? 'zoom-in'
                  : tool === 'text'
                    ? 'text'
                    : 'crosshair'
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => {
          hoverRef.current.inside = false
          setCursor(0, 0, false)
          scheduleDraw()
        }}
        onWheel={onWheel}
        onContextMenu={onContextMenu}
        onDoubleClick={onDoubleClick}
        tabIndex={0}
      >
        <canvas ref={canvasRef} className="main-canvas" />
        {textSession && textRect ? (
          <div
            className="text-editor-wrap"
            style={{
              left: textRect.left,
              top: textRect.top,
              width: textRect.width,
              height: textRect.height,
              background: textStyle.background ? color2 : 'transparent'
            }}
          >
            <textarea
              ref={textareaRef}
              className="text-editor"
              value={textSession.text}
              spellCheck={false}
              style={{
                fontFamily: `"${textStyle.family}", "Selawik", "Noto Sans", sans-serif`,
                fontSize: `${fontPx}px`,
                lineHeight: 1.2,
                fontWeight: textStyle.bold ? 700 : 400,
                fontStyle: textStyle.italic ? 'italic' : 'normal',
                textDecoration: textStyle.underline ? 'underline' : 'none',
                textAlign: textStyle.align,
                color: textStyle.color
              }}
              onChange={(e) => {
                const text = e.target.value
                const el = e.currentTarget
                const sh = el.scrollHeight / Math.max(0.1, view.zoom)
                const lines = text.split('\n').length
                const h = Math.max(lineHeightDoc(textStyle), lines * lineHeightDoc(textStyle) + 4, sh)
                useText.getState().update({ text, h: Math.max(textSession.h, h) })
                scheduleDraw()
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault()
                  useText.getState().close()
                  scheduleDraw()
                }
              }}
            />
          </div>
        ) : null}
        <Scrollbars width={view.vw} height={view.vh} />
      </div>
    </div>
  )
}

function lineHeightDoc(style: { size: number }): number {
  return (style.size * 96) / 72 * 1.2
}

function drawSelectionAnts(
  ctx: CanvasRenderingContext2D,
  pageX: number,
  pageY: number,
  zoom: number,
  time: number
): void {
  const sel = controller.selection
  if (!sel) return
  const segments = sel.getSegments()
  const phase = Math.floor(time / 90)
  const black = new Path2D()
  const white = new Path2D()
  for (const [x1, y1, x2, y2] of segments) {
    const path = (x1 + y1 + phase) % 8 < 4 ? black : white
    path.moveTo(pageX + x1 * zoom, pageY + y1 * zoom)
    path.lineTo(pageX + x2 * zoom, pageY + y2 * zoom)
  }
  ctx.save()
  ctx.lineWidth = 1
  ctx.strokeStyle = '#111111'
  ctx.stroke(black)
  ctx.strokeStyle = '#ffffff'
  ctx.stroke(white)
  ctx.restore()
}

function drawFloatingAnts(
  ctx: CanvasRenderingContext2D,
  pageX: number,
  pageY: number,
  zoom: number,
  time: number
): void {
  const f = controller.floating
  if (!f) return
  const offset = (time / 55) % 8
  ctx.save()
  ctx.translate(pageX + (f.x + f.w / 2) * zoom, pageY + (f.y + f.h / 2) * zoom)
  ctx.rotate(f.rotation)
  ctx.lineWidth = 1
  ctx.setLineDash([4, 4])
  for (const pass of [
    { color: '#ffffff', dash: 0 },
    { color: '#111111', dash: 4 }
  ]) {
    ctx.strokeStyle = pass.color
    ctx.lineDashOffset = pass.dash + offset
    ctx.strokeRect((-f.w * zoom) / 2, (-f.h * zoom) / 2, f.w * zoom, f.h * zoom)
  }
  ctx.restore()
}

function drawHandles(
  ctx: CanvasRenderingContext2D,
  pageX: number,
  pageY: number,
  zoom: number,
  floating: boolean
): void {
  const points = floating ? controller.getFloatingHandlePoints() : handlePointsFromSelection(zoom)
  ctx.save()
  for (const p of points) {
    const x = pageX + p.x * zoom
    const y = pageY + p.y * zoom
    if (p.mode === 'rotate') {
      ctx.beginPath()
      ctx.arc(x, y, 5, 0, Math.PI * 2)
      ctx.fillStyle = '#ffffff'
      ctx.fill()
      ctx.strokeStyle = '#333'
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(x, y + 5)
      ctx.lineTo(x, y + 10)
      ctx.stroke()
    } else {
      ctx.fillStyle = '#ffffff'
      ctx.strokeStyle = '#333333'
      ctx.lineWidth = 1
      ctx.fillRect(Math.round(x) - 3, Math.round(y) - 3, 7, 7)
      ctx.strokeRect(Math.round(x) - 3.5, Math.round(y) - 3.5, 7, 7)
    }
  }
  ctx.restore()
}

function handlePointsFromSelection(zoom: number): Array<{ mode: HandleMode; x: number; y: number }> {
  const sel = controller.selection
  if (!sel || !sel.bounds) return []
  const b = sel.bounds
  return [
    { mode: 'nw', x: b.x, y: b.y },
    { mode: 'n', x: b.x + b.w / 2, y: b.y },
    { mode: 'ne', x: b.x + b.w, y: b.y },
    { mode: 'e', x: b.x + b.w, y: b.y + b.h / 2 },
    { mode: 'se', x: b.x + b.w, y: b.y + b.h },
    { mode: 's', x: b.x + b.w / 2, y: b.y + b.h },
    { mode: 'sw', x: b.x, y: b.y + b.h },
    { mode: 'w', x: b.x, y: b.y + b.h / 2 },
    { mode: 'rotate', x: b.x + b.w / 2, y: b.y - 26 / zoom }
  ]
}

function RulerCanvas({
  orientation,
  width,
  height
}: {
  orientation: 'horizontal' | 'vertical'
  width: number
  height: number
}): React.ReactElement {
  const ref = useRef<HTMLCanvasElement>(null)
  const view = useUI((s) => s.view)
  const docWidth = useUI((s) => s.docWidth)
  const docHeight = useUI((s) => s.docHeight)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const dpr = Math.min(2.5, window.devicePixelRatio || 1)
    const w = Math.max(1, width)
    const h = Math.max(1, height)
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    const ctx = get2d(canvas)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = '#f6f6f6'
    ctx.fillRect(0, 0, w, h)
    const isH = orientation === 'horizontal'
    const length = isH ? w : h
    const size = isH ? h : w
    const offset = isH ? view.offsetX : view.offsetY
    const docSize = isH ? docWidth : docHeight
    const stepCandidates = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000]
    const major = stepCandidates.find((s) => s * view.zoom >= 52) ?? 5000
    const minor = Math.max(1, major / 5)
    const start = Math.max(0, Math.floor((0 - offset) / view.zoom / minor) * minor)
    const end = Math.min(docSize, Math.ceil((length - offset) / view.zoom))
    ctx.strokeStyle = '#8a8a8a'
    ctx.fillStyle = '#6a6a6a'
    ctx.lineWidth = 1
    ctx.font = '9px "Selawik", sans-serif'
    ctx.textBaseline = 'top'
    for (let d = start; d <= end; d += minor) {
      const p = offset + d * view.zoom
      if (p < 0 || p > length) continue
      const isMajor = Math.abs(d % major) < 0.0001
      const tick = isMajor ? 8 : 4
      ctx.beginPath()
      if (isH) {
        ctx.moveTo(Math.round(p) + 0.5, size)
        ctx.lineTo(Math.round(p) + 0.5, size - tick)
      } else {
        ctx.moveTo(size, Math.round(p) + 0.5)
        ctx.lineTo(size - tick, Math.round(p) + 0.5)
      }
      ctx.stroke()
      if (isMajor && p < length - 10) {
        if (isH) ctx.fillText(String(Math.round(d)), p + 2, 2)
        else ctx.fillText(String(Math.round(d)), 2, p + 1)
      }
    }
    ctx.strokeStyle = '#d4d4d4'
    ctx.beginPath()
    if (isH) {
      ctx.moveTo(0, h - 0.5)
      ctx.lineTo(w, h - 0.5)
    } else {
      ctx.moveTo(w - 0.5, 0)
      ctx.lineTo(w - 0.5, h)
    }
    ctx.stroke()
  }, [orientation, width, height, view, docWidth, docHeight])

  return <canvas ref={ref} className="ruler-canvas" />
}

function Scrollbars({ width, height }: { width: number; height: number }): React.ReactElement | null {
  const view = useUI((s) => s.view)
  const docWidth = useUI((s) => s.docWidth)
  const docHeight = useUI((s) => s.docHeight)
  const contentW = docWidth * view.zoom
  const contentH = docHeight * view.zoom
  const showH = contentW > width + 1
  const showV = contentH > height + 1
  const trackW = Math.max(20, width - 12)
  const trackH = Math.max(20, height - 12)
  const thumbW = Math.max(24, Math.min(trackW, (width / contentW) * trackW))
  const thumbH = Math.max(24, Math.min(trackH, (height / contentH) * trackH))
  const leftLimit = width - contentW - 28
  const rightLimit = 28
  const topLimit = height - contentH - 28
  const bottomLimit = 28
  const scrollX = (rightLimit - view.offsetX) / Math.max(1, rightLimit - leftLimit)
  const scrollY = (bottomLimit - view.offsetY) / Math.max(1, bottomLimit - topLimit)

  const dragThumb = (e: React.PointerEvent, axis: 'x' | 'y'): void => {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startY = e.clientY
    const startOffset = view.offsetX
    const startOffsetY = view.offsetY
    const move = (ev: PointerEvent): void => {
      if (axis === 'x') {
        const delta = ev.clientX - startX
        const range = Math.max(1, trackW - thumbW)
        const amount = (delta / range) * (rightLimit - leftLimit)
        useUI.getState().setViewOffset(startOffset - amount, useUI.getState().view.offsetY)
      } else {
        const delta = ev.clientY - startY
        const range = Math.max(1, trackH - thumbH)
        const amount = (delta / range) * (bottomLimit - topLimit)
        useUI.getState().setViewOffset(useUI.getState().view.offsetX, startOffsetY - amount)
      }
    }
    const up = (): void => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  if (!showH && !showV) return null
  return (
    <>
      {showV ? (
        <div className="scrollbar vertical">
          <div
            className="scrollbar-thumb"
            style={{
              height: thumbH,
              top: Math.max(0, Math.min(trackH - thumbH, scrollY * (trackH - thumbH)))
            }}
            onPointerDown={(e) => dragThumb(e, 'y')}
          />
        </div>
      ) : null}
      {showH ? (
        <div className="scrollbar horizontal" style={{ right: showV ? 12 : 0 }}>
          <div
            className="scrollbar-thumb"
            style={{
              width: thumbW,
              left: Math.max(0, Math.min(trackW - thumbW, scrollX * (trackW - thumbW)))
            }}
            onPointerDown={(e) => dragThumb(e, 'x')}
          />
        </div>
      ) : null}
    </>
  )
}
