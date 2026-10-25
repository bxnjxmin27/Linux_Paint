import { useEffect, useRef, useState } from 'react'
import { useUI } from '../state/store'
import { useT } from '../i18n'
import { controller } from '../engine/controller'
import { resolveUnsaved } from '../state/dialog'
import { PaintLogo } from './Glyphs'
import { get2d } from '../engine/canvas'
import { PALETTE } from '../engine/tools'

function DialogShell({
  title,
  children,
  actions,
  onClose,
  width
}: {
  title: string
  children: React.ReactNode
  actions: React.ReactNode
  onClose: () => void
  width?: number
}): React.ReactElement {
  const dialogRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div
      className="dialog-backdrop"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        className="dialog"
        style={{ width }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return
          const target = e.target as HTMLElement
          if (target instanceof HTMLButtonElement || target instanceof HTMLTextAreaElement) return
          e.preventDefault()
          dialogRef.current?.querySelector<HTMLButtonElement>('.btn.primary')?.click()
        }}
      >
        <div className="dialog-title">{title}</div>
        <div className="dialog-body">{children}</div>
        <div className="dialog-actions">{actions}</div>
      </div>
    </div>
  )
}

export function Dialogs(): React.ReactElement | null {
  const dialog = useUI((s) => s.dialog)
  if (!dialog) return null
  if (dialog === 'resize') return <ResizeDialog />
  if (dialog === 'canvas-size') return <CanvasSizeDialog />
  if (dialog === 'edit-colors') return <EditColorsDialog />
  if (dialog === 'properties') return <PropertiesDialog />
  if (dialog === 'about') return <AboutDialog />
  if (dialog === 'unsaved') return <UnsavedDialog />
  return null
}

function ResizeDialog(): React.ReactElement {
  const t = useT()
  const docW = useUI((s) => s.docWidth)
  const docH = useUI((s) => s.docHeight)
  const [unit, setUnit] = useState<'pixels' | 'percent'>('pixels')
  const [w, setW] = useState(docW)
  const [h, setH] = useState(docH)
  const [ratio, setRatio] = useState(true)
  const [skewX, setSkewX] = useState(0)
  const [skewY, setSkewY] = useState(0)
  const ratioValue = docW / docH

  const changeUnit = (next: 'pixels' | 'percent'): void => {
    if (next === unit) return
    if (next === 'percent') {
      setW(Math.round((w / docW) * 1000) / 10)
      setH(Math.round((h / docH) * 1000) / 10)
    } else {
      setW(Math.max(1, Math.round((w / 100) * docW)))
      setH(Math.max(1, Math.round((h / 100) * docH)))
    }
    setUnit(next)
  }

  const onW = (value: number): void => {
    setW(value)
    if (ratio) {
      if (unit === 'percent') setH(Math.round((value / ratioValue) * 10) / 10)
      else setH(Math.max(1, Math.round(value / ratioValue)))
    }
  }
  const onH = (value: number): void => {
    setH(value)
    if (ratio) {
      if (unit === 'percent') setW(Math.round(value * ratioValue * 10) / 10)
      else setW(Math.max(1, Math.round(value * ratioValue)))
    }
  }

  const apply = (): void => {
    const pxW = unit === 'pixels' ? w : Math.round((w / 100) * docW)
    const pxH = unit === 'pixels' ? h : Math.round((h / 100) * docH)
    controller.resizeAndSkew(Math.max(1, Math.min(10000, pxW)), Math.max(1, Math.min(10000, pxH)), skewX, skewY)
    useUI.getState().closeDialog()
  }

  return (
    <DialogShell
      title={t('resizeTitle')}
      onClose={() => useUI.getState().closeDialog()}
      width={460}
      actions={
        <>
          <button className="btn" onClick={() => useUI.getState().closeDialog()}>
            {t('cancel')}
          </button>
          <button className="btn primary" onClick={apply}>
            {t('ok')}
          </button>
        </>
      }
    >
      <div className="radio-row">
        <label>
          <input type="radio" checked={unit === 'percent'} onChange={() => changeUnit('percent')} />
          {t('percentage')}
        </label>
        <label>
          <input type="radio" checked={unit === 'pixels'} onChange={() => changeUnit('pixels')} />
          {t('pixels')}
        </label>
      </div>
      <div className="form-row">
        <label>{t('width')}</label>
        <input className="input narrow" type="number" min={1} value={w} onChange={(e) => onW(Number(e.target.value) || 1)} />
        <span style={{ color: 'var(--text-secondary)' }}>{unit === 'percent' ? '%' : 'px'}</span>
        <label style={{ marginLeft: 8 }}>{t('height')}</label>
        <input className="input narrow" type="number" min={1} value={h} onChange={(e) => onH(Number(e.target.value) || 1)} />
        <span style={{ color: 'var(--text-secondary)' }}>{unit === 'percent' ? '%' : 'px'}</span>
      </div>
      <label className="check-row" style={{ marginBottom: 4 }}>
        <input type="checkbox" checked={ratio} onChange={(e) => setRatio(e.target.checked)} />
        {t('maintainRatio')}
      </label>
      <div className="section">
        <div className="section-title">{t('skew')}</div>
        <div className="form-row">
          <label>{t('horizontal')}</label>
          <input className="input narrow" type="number" min={-89} max={89} value={skewX} onChange={(e) => setSkewX(Number(e.target.value) || 0)} />
          <span>°</span>
          <label style={{ marginLeft: 8 }}>{t('vertical')}</label>
          <input className="input narrow" type="number" min={-89} max={89} value={skewY} onChange={(e) => setSkewY(Number(e.target.value) || 0)} />
          <span>°</span>
        </div>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 12 }}>
        {t('imageSize')}: {docW} × {docH} px
      </div>
    </DialogShell>
  )
}

function CanvasSizeDialog(): React.ReactElement {
  const t = useT()
  const docW = useUI((s) => s.docWidth)
  const docH = useUI((s) => s.docHeight)
  const dpiNow = useUI((s) => s.dpi)
  const [unit, setUnit] = useState<'px' | 'in' | 'cm'>('px')
  const [w, setW] = useState(docW)
  const [h, setH] = useState(docH)
  const [dpi, setDpi] = useState(dpiNow)

  const toPx = (value: number, u: 'px' | 'in' | 'cm' = unit): number => {
    if (u === 'px') return Math.round(value)
    if (u === 'in') return Math.round(value * dpi)
    return Math.round((value / 2.54) * dpi)
  }
  const fromPx = (value: number, u: 'px' | 'in' | 'cm' = unit): number => {
    if (u === 'px') return Math.round(value * 100) / 100
    if (u === 'in') return Math.round((value / dpi) * 100) / 100
    return Math.round((value / dpi) * 2.54 * 100) / 100
  }
  const changeUnit = (next: 'px' | 'in' | 'cm'): void => {
    const pxW = toPx(w, unit)
    const pxH = toPx(h, unit)
    setW(fromPx(pxW, next))
    setH(fromPx(pxH, next))
    setUnit(next)
  }
  const apply = (): void => {
    controller.resizeCanvas(Math.max(1, Math.min(10000, toPx(w, unit))), Math.max(1, Math.min(10000, toPx(h, unit))), 'top-left')
    controller.setDpi(dpi)
    useUI.getState().closeDialog()
  }
  return (
    <DialogShell
      title={t('canvasSizeTitle')}
      onClose={() => useUI.getState().closeDialog()}
      width={470}
      actions={
        <>
          <button className="btn" onClick={() => useUI.getState().closeDialog()}>
            {t('cancel')}
          </button>
          <button className="btn primary" onClick={apply}>
            {t('ok')}
          </button>
        </>
      }
    >
      <div className="form-row">
        <label>{t('units')}</label>
        <select className="input" style={{ width: 160 }} value={unit} onChange={(e) => changeUnit(e.target.value as 'px' | 'in' | 'cm')}>
          <option value="px">{t('pixels')}</option>
          <option value="in">{t('inches')}</option>
          <option value="cm">{t('centimeters')}</option>
        </select>
      </div>
      <div className="form-row">
        <label>{t('width')}</label>
        <input className="input narrow" type="number" min={0.01} value={w} onChange={(e) => setW(Number(e.target.value) || 1)} />
        <label style={{ marginLeft: 8 }}>{t('height')}</label>
        <input className="input narrow" type="number" min={0.01} value={h} onChange={(e) => setH(Number(e.target.value) || 1)} />
      </div>
      <div className="form-row">
        <label>{t('resolution')}</label>
        <input className="input narrow" type="number" min={1} max={1200} value={dpi} onChange={(e) => setDpi(Number(e.target.value) || 96)} />
        <span>DPI</span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
        {t('imageSize')}: {docW} × {docH} px
      </div>
    </DialogShell>
  )
}

function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c
  let r = 0
  let g = 0
  let b = 0
  if (h < 60) [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  return { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255) }
}

function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const d = max - min
  let h = 0
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6
    else if (max === gn) h = (bn - rn) / d + 2
    else h = (rn - gn) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  return { h, s: max === 0 ? 0 : d / max, v: max }
}

function hexOf(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0')).join('')}`
}

function parseHex(value: string): { r: number; g: number; b: number } | null {
  const m = value.trim().match(/^#?([0-9a-f]{6})$/i)
  if (!m) return null
  const n = Number.parseInt(m[1], 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

function EditColorsDialog(): React.ReactElement {
  const t = useT()
  const target = useUI((s) => s.editingColor)
  const color1 = useUI((s) => s.color1)
  const color2 = useUI((s) => s.color2)
  const recent = useUI((s) => s.recentColors)
  const initial = target === 1 ? color1 : color2
  const initRgb = parseHex(initial) ?? { r: 0, g: 0, b: 0 }
  const initHsv = rgbToHsv(initRgb.r, initRgb.g, initRgb.b)
  const [h, setH] = useState(initHsv.h)
  const [s, setS] = useState(initHsv.s)
  const [v, setV] = useState(initHsv.v)
  const [hex, setHex] = useState(initial)
  const spectrumRef = useRef<HTMLCanvasElement>(null)
  const hueBarRef = useRef<HTMLDivElement>(null)
  const rgb = hsvToRgb(h, s, v)
  const currentHex = hexOf(rgb.r, rgb.g, rgb.b)

  useEffect(() => {
    const canvas = spectrumRef.current
    if (!canvas) return
    const ctx = get2d(canvas)
    const w = canvas.width
    const height = canvas.height
    const hueColor = hsvToRgb(h, 1, 1)
    const gradH = ctx.createLinearGradient(0, 0, w, 0)
    gradH.addColorStop(0, '#ffffff')
    gradH.addColorStop(1, `rgb(${hueColor.r},${hueColor.g},${hueColor.b})`)
    ctx.fillStyle = gradH
    ctx.fillRect(0, 0, w, height)
    const gradV = ctx.createLinearGradient(0, 0, 0, height)
    gradV.addColorStop(0, 'rgba(0,0,0,0)')
    gradV.addColorStop(1, '#000000')
    ctx.fillStyle = gradV
    ctx.fillRect(0, 0, w, height)
  }, [h])

  useEffect(() => {
    setHex(currentHex)
  }, [currentHex])

  const setFromRgb = (r: number, g: number, b: number): void => {
    const hsv = rgbToHsv(r, g, b)
    setH(hsv.h)
    setS(hsv.s)
    setV(hsv.v)
  }

  const onSpectrum = (e: React.PointerEvent<HTMLCanvasElement>): void => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left))
    const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top))
    setS(x / rect.width)
    setV(1 - y / rect.height)
  }
  const onHue = (e: React.PointerEvent<HTMLDivElement>): void => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left))
    setH((x / rect.width) * 360)
  }

  const apply = (): void => {
    if (target === 1) useUI.getState().setColor1(currentHex)
    else useUI.getState().setColor2(currentHex)
    useUI.getState().addRecentColor(currentHex)
    useUI.getState().closeDialog()
  }

  const oldColor = target === 1 ? color1 : color2

  return (
    <DialogShell
      title={t('editColorsTitle')}
      onClose={() => useUI.getState().closeDialog()}
      width={520}
      actions={
        <>
          <button className="btn" onClick={() => useUI.getState().closeDialog()}>
            {t('cancel')}
          </button>
          <button className="btn primary" onClick={apply}>
            {t('ok')}
          </button>
        </>
      }
    >
      <div className="color-edit-grid">
        <div>
          <div className="color-spectrum">
            <canvas
              ref={spectrumRef}
              width={220}
              height={150}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId)
                onSpectrum(e)
              }}
              onPointerMove={(e) => {
                if (e.buttons) onSpectrum(e)
              }}
            />
            <span className="spectrum-cursor" style={{ left: `${s * 100}%`, top: `${(1 - v) * 100}%` }} />
          </div>
          <div
            ref={hueBarRef}
            className="hue-bar"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId)
              onHue(e)
            }}
            onPointerMove={(e) => {
              if (e.buttons) onHue(e)
            }}
          >
            <span className="hue-thumb" style={{ left: `${(h / 360) * 100}%` }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
            <div className="color-preview" style={{ background: oldColor }} title={t('colorPreview')} />
            <div className="color-preview" style={{ background: currentHex }} title={t('colorPreview')} />
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{currentHex.toUpperCase()}</span>
          </div>
        </div>
        <div className="color-meta">
          <div className="form-row">
            <label>{t('red')}</label>
            <input
              className="input"
              type="number"
              min={0}
              max={255}
              value={rgb.r}
              onChange={(e) => setFromRgb(Number(e.target.value) || 0, rgb.g, rgb.b)}
            />
          </div>
          <div className="form-row">
            <label>{t('green')}</label>
            <input
              className="input"
              type="number"
              min={0}
              max={255}
              value={rgb.g}
              onChange={(e) => setFromRgb(rgb.r, Number(e.target.value) || 0, rgb.b)}
            />
          </div>
          <div className="form-row">
            <label>{t('blue')}</label>
            <input
              className="input"
              type="number"
              min={0}
              max={255}
              value={rgb.b}
              onChange={(e) => setFromRgb(rgb.r, rgb.g, Number(e.target.value) || 0)}
            />
          </div>
          <div className="form-row">
            <label>{t('hex')}</label>
            <input
              className="input"
              value={hex}
              onChange={(e) => {
                setHex(e.target.value)
                const parsed = parseHex(e.target.value)
                if (parsed) setFromRgb(parsed.r, parsed.g, parsed.b)
              }}
            />
          </div>
          <div className="section" style={{ marginTop: 4 }}>
            <div className="section-title">{t('customColors')}</div>
            <div className="custom-color-grid">
              {[...new Set([...recent, ...PALETTE])].slice(0, 24).map((color) => (
                <button
                  key={color}
                  className="swatch"
                  style={{ background: color }}
                  title={color}
                  onClick={() => {
                    const parsed = parseHex(color)
                    if (parsed) setFromRgb(parsed.r, parsed.g, parsed.b)
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </DialogShell>
  )
}

function PropertiesDialog(): React.ReactElement {
  const t = useT()
  const fileName = useUI((s) => s.fileName)
  const filePath = useUI((s) => s.filePath)
  const docW = useUI((s) => s.docWidth)
  const docH = useUI((s) => s.docHeight)
  const dpi = useUI((s) => s.dpi)
  return (
    <DialogShell
      title={t('propertiesTitle')}
      onClose={() => useUI.getState().closeDialog()}
      actions={
        <button className="btn primary" onClick={() => useUI.getState().closeDialog()}>
          {t('ok')}
        </button>
      }
    >
      <div className="form-row">
        <label>{t('fileName')}</label>
        <span style={{ userSelect: 'text' }}>{filePath ?? fileName}</span>
      </div>
      <div className="form-row">
        <label>{t('dimensions')}</label>
        <span>
          {docW} × {docH} px
        </span>
      </div>
      <div className="form-row">
        <label>{t('resolution')}</label>
        <span>{dpi} DPI</span>
      </div>
    </DialogShell>
  )
}

function AboutDialog(): React.ReactElement {
  const t = useT()
  const [version, setVersion] = useState('0.1.0')
  useEffect(() => {
    void window.paint.getVersion().then(setVersion)
  }, [])
  return (
    <DialogShell
      title={t('about')}
      onClose={() => useUI.getState().closeDialog()}
      actions={
        <button className="btn primary" onClick={() => useUI.getState().closeDialog()}>
          {t('ok')}
        </button>
      }
    >
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 12 }}>
        <PaintLogo size={48} />
        <div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Paint {version}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Linux Edition</div>
        </div>
      </div>
      <p>{t('aboutText')}</p>
    </DialogShell>
  )
}

function UnsavedDialog(): React.ReactElement {
  const t = useT()
  const fileName = useUI((s) => s.fileName)
  return (
    <DialogShell
      title={t('unsavedTitle')}
      onClose={() => resolveUnsaved('cancel')}
      actions={
        <>
          <button className="btn" onClick={() => resolveUnsaved('cancel')}>
            {t('cancel')}
          </button>
          <button className="btn" onClick={() => resolveUnsaved('discard')}>
            {t('discard')}
          </button>
          <button className="btn primary" onClick={() => resolveUnsaved('save')}>
            {t('save')}
          </button>
        </>
      }
    >
      <p>{t('unsavedText')}</p>
      <p style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{fileName}</p>
    </DialogShell>
  )
}
