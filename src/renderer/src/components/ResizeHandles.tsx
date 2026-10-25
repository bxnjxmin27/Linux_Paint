import { useEffect, useRef, useState } from 'react'

type Dir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

export function ResizeHandles(): React.ReactElement | null {
  const dragRef = useRef<{
    dir: Dir
    startX: number
    startY: number
    bounds: { x: number; y: number; width: number; height: number }
  } | null>(null)
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    void window.paint.window.isMaximized().then(setMaximized)
    return window.paint.window.onMaximizeChange(setMaximized)
  }, [])

  useEffect(() => {
    let raf = 0
    let latest: { x: number; y: number; width: number; height: number } | null = null
    const flush = (): void => {
      raf = 0
      if (latest) {
        void window.paint.window.setBounds(latest)
        latest = null
      }
    }
    const move = (e: PointerEvent): void => {
      const drag = dragRef.current
      if (!drag) return
      const dx = e.clientX - drag.startX
      const dy = e.clientY - drag.startY
      const b = drag.bounds
      let x = b.x
      let y = b.y
      let width = b.width
      let height = b.height
      if (drag.dir.includes('e')) width = b.width + dx
      if (drag.dir.includes('s')) height = b.height + dy
      if (drag.dir.includes('w')) {
        width = b.width - dx
        x = b.x + dx
      }
      if (drag.dir.includes('n')) {
        height = b.height - dy
        y = b.y + dy
      }
      if (width < 900) {
        if (drag.dir.includes('w')) x = b.x + b.width - 900
        width = 900
      }
      if (height < 600) {
        if (drag.dir.includes('n')) y = b.y + b.height - 600
        height = 600
      }
      latest = {
        x: Math.round(x),
        y: Math.round(y),
        width: Math.round(width),
        height: Math.round(height)
      }
      if (!raf) raf = requestAnimationFrame(flush)
    }
    const up = (): void => {
      dragRef.current = null
      document.body.style.cursor = ''
      if (raf) {
        cancelAnimationFrame(raf)
        raf = 0
      }
      if (latest) void window.paint.window.setBounds(latest)
      latest = null
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [])

  const start = (dir: Dir, e: React.PointerEvent<HTMLDivElement>): void => {
    e.preventDefault()
    e.stopPropagation()
    const el = e.currentTarget
    const cursor = getComputedStyle(el).cursor
    void window.paint.window.getBounds().then((bounds) => {
      dragRef.current = { dir, startX: e.clientX, startY: e.clientY, bounds }
      document.body.style.cursor = cursor
    })
  }

  const dirs: Array<{ dir: Dir; className: string }> = [
    { dir: 'n', className: 'rh-n' },
    { dir: 's', className: 'rh-s' },
    { dir: 'e', className: 'rh-e' },
    { dir: 'w', className: 'rh-w' },
    { dir: 'ne', className: 'rh-ne' },
    { dir: 'nw', className: 'rh-nw' },
    { dir: 'se', className: 'rh-se' },
    { dir: 'sw', className: 'rh-sw' }
  ]

  if (maximized) return null

  return (
    <>
      {dirs.map((d) => (
        <div key={d.dir} className={`resize-handle ${d.className}`} onPointerDown={(e) => start(d.dir, e)} />
      ))}
    </>
  )
}
