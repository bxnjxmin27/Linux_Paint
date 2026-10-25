import { useEffect, useState } from 'react'
import { useUI } from '../state/store'
import { useT } from '../i18n'
import { closeWindow } from '../actions'
import { CloseGlyph, MaximizeGlyph, MinimizeGlyph, PaintLogo, RestoreGlyph } from './Glyphs'

export function TitleBar(): React.ReactElement {
  const t = useT()
  const fileName = useUI((s) => s.fileName)
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    void window.paint.window.isMaximized().then(setMaximized)
    return window.paint.window.onMaximizeChange(setMaximized)
  }, [])

  return (
    <header
      className="titlebar"
      onDoubleClick={(e) => {
        if ((e.target as HTMLElement).closest('.window-controls')) return
        void window.paint.window.toggleMaximize().then(setMaximized)
      }}
    >
      <span className="titlebar-icon">
        <PaintLogo size={16} />
      </span>
      <span className="app-title">{`${fileName} - Paint`}</span>
      <span className="titlebar-spacer" />
      <div className="window-controls">
        <button
          className="win-btn"
          title={t('minimize')}
          onClick={() => void window.paint.window.minimize()}
        >
          <MinimizeGlyph />
        </button>
        <button
          className="win-btn"
          title={maximized ? t('restore') : t('maximize')}
          onClick={() => void window.paint.window.toggleMaximize().then(setMaximized)}
        >
          {maximized ? <RestoreGlyph /> : <MaximizeGlyph />}
        </button>
        <button className="win-btn close" title={t('close')} onClick={() => void closeWindow()}>
          <CloseGlyph />
        </button>
      </div>
    </header>
  )
}
