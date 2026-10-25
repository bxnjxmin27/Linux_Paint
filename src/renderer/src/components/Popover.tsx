import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export function Popover({
  anchor,
  onClose,
  children,
  width,
  align = 'left',
  className = '',
  gap = 4
}: {
  anchor: DOMRect
  onClose: () => void
  children: React.ReactNode
  width?: number
  align?: 'left' | 'right' | 'center'
  className?: string
  gap?: number
}): React.ReactElement {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: anchor.left, top: anchor.bottom + gap })

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    let left = anchor.left
    if (align === 'right') left = anchor.right - rect.width
    if (align === 'center') left = anchor.left + anchor.width / 2 - rect.width / 2
    left = Math.max(6, Math.min(window.innerWidth - rect.width - 6, left))
    let top = anchor.bottom + gap
    if (top + rect.height > window.innerHeight - 6) top = Math.max(6, anchor.top - rect.height - gap)
    setPos({ left, top })
  }, [anchor, align, gap])

  useEffect(() => {
    const onPointerDown = (e: PointerEvent): void => {
      const el = ref.current
      if (el && e.target instanceof Node && el.contains(e.target)) return
      if (e.target instanceof Node && (e.target as HTMLElement).closest('.menu-btn')) return
      onClose()
    }
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  return createPortal(
    <div
      ref={ref}
      className={`menu-popover ${className}`}
      style={{ left: pos.left, top: pos.top, width: width ?? undefined }}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body
  )
}
