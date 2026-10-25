import { useEffect, useRef } from 'react'
import { drawShapeThumb } from '../engine/shapes'
import { drawBrushPreview } from '../engine/brushes'
import type { ShapeType, BrushType } from '../engine/tools'
import { createCanvas, get2d } from '../engine/canvas'

function useHiDpiCanvas(
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  deps: unknown[]
): React.RefObject<HTMLCanvasElement | null> {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const dpr = Math.min(3, window.devicePixelRatio || 1)
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    const ctx = get2d(canvas)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    draw(ctx, width, height)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return ref
}

export function ShapeThumb({
  type,
  color,
  size = 20
}: {
  type: ShapeType
  color: string
  size?: number
}): React.ReactElement {
  const ref = useHiDpiCanvas(
    size,
    size,
    (ctx, w, h) => drawShapeThumb(ctx, type, w, h, color),
    [type, color, size]
  )
  return <canvas ref={ref} style={{ width: size, height: size }} />
}

export function BrushThumb({
  type,
  color,
  width = 40,
  height = 28,
  size = 6
}: {
  type: BrushType
  color: string
  width?: number
  height?: number
  size?: number
}): React.ReactElement {
  const ref = useHiDpiCanvas(
    width,
    height,
    (ctx, w, h) => {
      const temp = createCanvas(w, h)
      drawBrushPreview(temp, type, color, size)
      ctx.drawImage(temp, 0, 0)
    },
    [type, color, width, height, size]
  )
  return <canvas ref={ref} style={{ width, height }} />
}

export function LayerThumb({ src }: { src: string }): React.ReactElement {
  return <img src={src} alt="" draggable={false} />
}
