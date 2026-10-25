import { useEffect, useState } from 'react'
import { useText } from '../state/text'
import { useUI } from '../state/store'
import { useT } from '../i18n'
import { Icon } from './Icon'
import { controller } from '../engine/controller'
import { getFonts } from '../fonts'

export function TextBar(): React.ReactElement | null {
  const t = useT()
  const session = useText((s) => s.session)
  const style = useText((s) => s.style)
  const setStyle = useText((s) => s.setStyle)
  const [fonts, setFonts] = useState<string[]>(['Selawik'])
  const color2 = useUI((s) => s.color2)

  useEffect(() => {
    void getFonts().then(setFonts)
  }, [])

  const commit = (): void => {
    const s = useText.getState().session
    if (s) controller.commitText(s, useText.getState().style)
    else useText.getState().close()
  }

  const cancel = (): void => {
    useText.getState().close()
    controller.repaint?.()
  }

  return (
    <div className="text-toolbar">
      <select
        className="input font-select"
        value={style.family}
        onChange={(e) => setStyle({ family: e.target.value })}
        title={t('font')}
      >
        {fonts.map((font) => (
          <option key={font} value={font}>
            {font}
          </option>
        ))}
      </select>
      <input
        className="input size-input"
        type="number"
        min={1}
        max={300}
        value={style.size}
        onChange={(e) => setStyle({ size: Math.max(1, Math.min(300, Number(e.target.value) || 12)) })}
        title={t('fontSize')}
      />
      <button
        className={`icon-btn${style.bold ? ' active' : ''}`}
        title={t('bold')}
        onClick={() => setStyle({ bold: !style.bold })}
      >
        <Icon name="textBold" size={17} />
      </button>
      <button
        className={`icon-btn${style.italic ? ' active' : ''}`}
        title={t('italic')}
        onClick={() => setStyle({ italic: !style.italic })}
      >
        <Icon name="textItalic" size={17} />
      </button>
      <button
        className={`icon-btn${style.underline ? ' active' : ''}`}
        title={t('underline')}
        onClick={() => setStyle({ underline: !style.underline })}
      >
        <Icon name="textUnderline" size={17} />
      </button>
      <span style={{ width: 1, height: 22, background: 'var(--border)', margin: '0 4px' }} />
      <button
        className={`icon-btn${style.align === 'left' ? ' active' : ''}`}
        title={t('alignLeft')}
        onClick={() => setStyle({ align: 'left' })}
      >
        <Icon name="textAlignLeft" size={17} />
      </button>
      <button
        className={`icon-btn${style.align === 'center' ? ' active' : ''}`}
        title={t('alignCenter')}
        onClick={() => setStyle({ align: 'center' })}
      >
        <Icon name="textAlignCenter" size={17} />
      </button>
      <button
        className={`icon-btn${style.align === 'right' ? ' active' : ''}`}
        title={t('alignRight')}
        onClick={() => setStyle({ align: 'right' })}
      >
        <Icon name="textAlignRight" size={17} />
      </button>
      <span style={{ width: 1, height: 22, background: 'var(--border)', margin: '0 4px' }} />
      <label className="text-color-wrap" title={t('textColor')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <input
          type="color"
          className="color-preview"
          value={style.color}
          onChange={(e) => setStyle({ color: e.target.value })}
          style={{ width: 28, height: 24, padding: 0, border: '1px solid var(--border-input)' }}
        />
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('textColor')}</span>
      </label>
      <button
        className={`icon-btn${style.background ? ' active' : ''}`}
        title={`${t('textBackground')}: ${style.background ? t('solid') : t('none')}`}
        onClick={() => setStyle({ background: !style.background })}
        style={{ width: 'auto', padding: '0 8px', gap: 6 }}
      >
        <span
          style={{
            width: 16,
            height: 14,
            border: '1px solid var(--border-input)',
            background: style.background ? color2 : 'transparent',
            display: 'inline-block'
          }}
        />
        {t('textBackground')}
      </button>
      <div className="spacer" />
      {session ? (
        <>
          <button className="btn" style={{ minWidth: 90, height: 28 }} onClick={cancel}>
            {t('cancelText')}
          </button>
          <button className="btn primary" style={{ minWidth: 100, height: 28 }} onClick={commit}>
            {t('commitText')}
          </button>
        </>
      ) : null}
    </div>
  )
}
