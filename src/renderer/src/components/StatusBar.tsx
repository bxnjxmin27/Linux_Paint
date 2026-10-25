import { useRef, useState } from 'react'
import { useUI } from '../state/store'
import { useCursor } from '../state/cursor'
import { useT } from '../i18n'
import { Icon } from './Icon'
import { MenuPopover, type MenuEntry } from './Menus'

const PRESETS = [10, 25, 50, 75, 100, 150, 200, 300, 400, 600, 800]

export function StatusBar(): React.ReactElement | null {
  const t = useT()
  const show = useUI((s) => s.showStatus)
  const docWidth = useUI((s) => s.docWidth)
  const docHeight = useUI((s) => s.docHeight)
  const zoom = useUI((s) => s.view.zoom)
  const selection = useUI((s) => s.selection)
  const cursor = useCursor()
  const [zoomMenu, setZoomMenu] = useState<DOMRect | null>(null)
  const percentRef = useRef<HTMLButtonElement>(null)

  if (!show) return null

  const tValue = Math.log(zoom / 0.1) / Math.log(80)
  const sliderValue = Math.max(0, Math.min(1000, Math.round(tValue * 1000)))

  const entries: MenuEntry[] = [
    ...PRESETS.map((p) => ({
      type: 'item' as const,
      label: `${p}%`,
      checked: Math.abs(zoom * 100 - p) < 0.5,
      onClick: () => useUI.getState().zoomTo(p / 100)
    })),
    { type: 'separator' as const },
    { type: 'item', label: t('fitWindow'), onClick: () => useUI.getState().fitToWindow() }
  ]

  return (
    <footer className="statusbar">
      <div className="status-left">
        <span className="status-coords">
          <span>
            {cursor.inside ? Math.floor(cursor.x) : '—'}, {cursor.inside ? Math.floor(cursor.y) : '—'}
          </span>
        </span>
        {selection ? (
          <span className="status-selection">
            {t('selectionSize')}: {Math.round(selection.w)} × {Math.round(selection.h)} px
          </span>
        ) : (
          <span className="status-selection" />
        )}
      </div>
      <div className="status-center">
        <span className="status-size">
          {docWidth} × {docHeight}px
        </span>
      </div>
      <div className="status-right">
        <button className="status-toggle" title={t('zoomOut')} onClick={() => useUI.getState().zoomStep(-1)}>
          <Icon name="zoomOut" size={15} />
        </button>
        <input
          className="zoom-slider"
          type="range"
          min={0}
          max={1000}
          value={sliderValue}
          onChange={(e) => {
            const tVal = Number(e.target.value) / 1000
            const next = 0.1 * Math.pow(80, tVal)
            useUI.getState().zoomTo(next)
          }}
          title={t('zoom')}
        />
        <button className="status-toggle" title={t('zoomIn')} onClick={() => useUI.getState().zoomStep(1)}>
          <Icon name="zoomIn" size={15} />
        </button>
        <button
          ref={percentRef}
          className="zoom-value"
          title={t('zoom')}
          onClick={() => setZoomMenu(percentRef.current?.getBoundingClientRect() ?? null)}
        >
          {Math.round(zoom * 100)}%
        </button>
        <button className="status-toggle" title={t('fitWindow')} onClick={() => useUI.getState().fitToWindow()}>
          <Icon name="zoomFit" size={15} />
        </button>
        <button
          className="status-toggle"
          title={t('fullscreen')}
          onClick={() => {
            if (document.fullscreenElement) void document.exitFullscreen()
            else void document.documentElement.requestFullscreen()
          }}
        >
          <Icon name="fullscreen" size={14} />
        </button>
      </div>
      {zoomMenu ? <MenuPopover anchor={zoomMenu} entries={entries} onClose={() => setZoomMenu(null)} align="right" minWidth={170} /> : null}
    </footer>
  )
}
