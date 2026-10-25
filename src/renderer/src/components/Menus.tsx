import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon, type IconName } from './Icon'
import { ChevronRightGlyph } from './Glyphs'

export type MenuEntry =
  | {
      type: 'item'
      label: string
      icon?: IconName
      shortcut?: string
      disabled?: boolean
      checked?: boolean
      onClick: () => void
    }
  | {
      type: 'submenu'
      label: string
      icon?: IconName
      disabled?: boolean
      items: MenuEntry[]
    }
  | { type: 'separator' }
  | { type: 'section'; label: string }

interface MenuListProps {
  entries: MenuEntry[]
  onClose: () => void
  className?: string
}

function MenuList({ entries, onClose }: MenuListProps): React.ReactElement {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  return (
    <>
      {entries.map((entry, index) => {
        if (entry.type === 'separator') return <div className="menu-sep" key={`sep-${index}`} />
        if (entry.type === 'section')
          return (
            <div className="menu-section" key={`section-${index}`}>
              {entry.label}
            </div>
          )
        if (entry.type === 'submenu') {
          return (
            <div
              key={`${entry.label}-${index}`}
              className={`menu-item${entry.disabled ? ' disabled' : ''}`}
              onMouseEnter={() => setOpenIndex(index)}
              onMouseLeave={() => setOpenIndex((v) => (v === index ? null : v))}
              onClick={(e) => {
                e.stopPropagation()
                if (!entry.disabled) setOpenIndex((v) => (v === index ? null : index))
              }}
            >
              <span className="menu-icon">{entry.icon ? <Icon name={entry.icon} size={16} /> : null}</span>
              <span className="menu-label">{entry.label}</span>
              <span className="menu-submenu-arrow">
                <ChevronRightGlyph />
              </span>
              {openIndex === index && !entry.disabled ? (
                <div
                  className="menu-popover"
                  style={{ position: 'absolute', left: '100%', top: -5, marginLeft: 2 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <MenuList entries={entry.items} onClose={onClose} />
                </div>
              ) : null}
            </div>
          )
        }
        return (
          <div
            key={`${entry.label}-${index}`}
            className={`menu-item${entry.disabled ? ' disabled' : ''}`}
            onClick={() => {
              if (entry.disabled) return
              onClose()
              entry.onClick()
            }}
            onMouseEnter={() => setOpenIndex(null)}
          >
            <span className="menu-icon">
              {entry.checked ? (
                <span className="menu-check">
                  <Icon name="check" size={15} />
                </span>
              ) : entry.icon ? (
                <Icon name={entry.icon} size={16} />
              ) : null}
            </span>
            <span className="menu-label">{entry.label}</span>
            {entry.shortcut ? <span className="menu-shortcut">{entry.shortcut}</span> : null}
          </div>
        )
      })}
    </>
  )
}

export function MenuPopover({
  anchor,
  entries,
  onClose,
  align = 'left',
  minWidth
}: {
  anchor: DOMRect
  entries: MenuEntry[]
  onClose: () => void
  align?: 'left' | 'right'
  minWidth?: number
}): React.ReactElement {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number }>({
    left: anchor.left,
    top: anchor.bottom + 2
  })

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    let left = align === 'right' ? anchor.right - rect.width : anchor.left
    let top = anchor.bottom + 2
    if (left + rect.width > window.innerWidth - 6) left = window.innerWidth - rect.width - 6
    if (left < 6) left = 6
    if (top + rect.height > window.innerHeight - 6) {
      top = Math.max(6, anchor.top - rect.height - 2)
    }
    setPos({ left, top })
  }, [anchor, align])

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
      className="menu-popover"
      style={{ left: pos.left, top: pos.top, minWidth }}
      onClick={(e) => e.stopPropagation()}
    >
      <MenuList entries={entries} onClose={onClose} />
    </div>,
    document.body
  )
}

export function ContextMenu({
  x,
  y,
  entries,
  onClose
}: {
  x: number
  y: number
  entries: MenuEntry[]
  onClose: () => void
}): React.ReactElement {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: x, top: y })

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    let left = x
    let top = y
    if (left + rect.width > window.innerWidth - 6) left = window.innerWidth - rect.width - 6
    if (top + rect.height > window.innerHeight - 6) top = Math.max(6, y - rect.height)
    setPos({ left, top })
  }, [x, y])

  useEffect(() => {
    const close = (e: PointerEvent): void => {
      const el = ref.current
      if (el && e.target instanceof Node && el.contains(e.target)) return
      onClose()
    }
    window.addEventListener('pointerdown', close, true)
    const key = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('pointerdown', close, true)
      window.removeEventListener('keydown', key)
    }
  }, [onClose])

  return createPortal(
    <div
      ref={ref}
      className="menu-popover"
      style={{ left: pos.left, top: pos.top, minWidth: 210 }}
      onClick={(e) => e.stopPropagation()}
    >
      <MenuList entries={entries} onClose={onClose} />
    </div>,
    document.body
  )
}
