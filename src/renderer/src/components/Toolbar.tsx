import { useRef, useState } from 'react'
import { useUI } from '../state/store'
import { useT } from '../i18n'
import { Icon } from './Icon'
import { ShapeThumb, BrushThumb } from './Thumbs'
import { Popover } from './Popover'
import { MenuPopover, type MenuEntry } from './Menus'
import { BRUSHES, PALETTE, SHAPES } from '../engine/tools'
import { controller } from '../engine/controller'
import { activateTool } from '../actions'
import { LassoGlyph, MagnifierGlyph, PencilGlyph, RectSelectGlyph } from './Glyphs'

function Group({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }): React.ReactElement {
  return (
    <div className={`ribbon-group ${className}`}>
      <div className="ribbon-body">{children}</div>
      <div className="ribbon-label">{label}</div>
    </div>
  )
}

function ToolButton({
  icon,
  title,
  active,
  disabled,
  onClick,
  custom
}: {
  icon?: React.ReactNode
  title: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  custom?: React.ReactNode
}): React.ReactElement {
  return (
    <button
      className={`tool-btn${active ? ' active' : ''}`}
      title={title}
      disabled={disabled}
      onClick={onClick}
    >
      {custom ?? icon}
    </button>
  )
}

export function Toolbar(): React.ReactElement {
  const t = useT()
  const tool = useUI((s) => s.tool)
  const color1 = useUI((s) => s.color1)
  const color2 = useUI((s) => s.color2)
  const brushType = useUI((s) => s.brushType)
  const brushSize = useUI((s) => s.brushSize)
  const shapeType = useUI((s) => s.shapeType)
  const shapeOutline = useUI((s) => s.shapeOutline)
  const shapeFill = useUI((s) => s.shapeFill)
  const shapeThickness = useUI((s) => s.shapeThickness)
  const layersOpen = useUI((s) => s.layersOpen)
  const selection = useUI((s) => s.selection)
  const [brushOpen, setBrushOpen] = useState<DOMRect | null>(null)
  const [sizeOpen, setSizeOpen] = useState<DOMRect | null>(null)
  const [shapeSizeOpen, setShapeSizeOpen] = useState<DOMRect | null>(null)
  const [copilotOpen, setCopilotOpen] = useState<DOMRect | null>(null)
  const [imageMenu, setImageMenu] = useState<{ kind: 'rotate' | 'flip'; rect: DOMRect } | null>(null)
  const [imageMore, setImageMore] = useState<DOMRect | null>(null)
  const brushBtn = useRef<HTMLButtonElement>(null)
  const sizeBtn = useRef<HTMLButtonElement>(null)
  const shapeSizeBtn = useRef<HTMLButtonElement>(null)
  const copilotBtn = useRef<HTMLButtonElement>(null)
  const rotateBtn = useRef<HTMLButtonElement>(null)
  const flipBtn = useRef<HTMLButtonElement>(null)
  const moreBtn = useRef<HTMLButtonElement>(null)

  const currentBrush = BRUSHES.find((b) => b.id === brushType) ?? BRUSHES[0]
  const brushLabel = useUI((s) => s.language) === 'de' ? currentBrush.de : currentBrush.en

  const imageEntries: MenuEntry[] =
    imageMenu?.kind === 'rotate'
      ? [
          { type: 'item', label: t('rotate90'), onClick: () => controller.rotate(90) },
          { type: 'item', label: t('rotate180'), onClick: () => controller.rotate(180) },
          { type: 'item', label: t('rotate270'), onClick: () => controller.rotate(270) }
        ]
      : [
          { type: 'item', label: t('flipH'), onClick: () => controller.flip(true) },
          { type: 'item', label: t('flipV'), onClick: () => controller.flip(false) }
        ]

  return (
    <div className="ribbon">
      <div className="ribbon-scroll">
        <Group label={t('clipboard')}>
          <div className="small-grid one-row">
            <ToolButton icon={<Icon name="clipboard" />} title={t('paste')} onClick={() => void controller.paste()} />
            <ToolButton icon={<Icon name="cut" />} title={t('cut')} onClick={() => void controller.cutSelection()} />
            <ToolButton icon={<Icon name="copy" />} title={t('copy')} onClick={() => void controller.copySelection()} />
          </div>
        </Group>

        <Group label={t('selection')}>
          <div className="small-grid one-row">
            <ToolButton
              custom={<RectSelectGlyph size={19} />}
              title={t('selectRect')}
              active={tool === 'select-rect'}
              onClick={() => activateTool('select-rect')}
            />
            <ToolButton
              custom={<LassoGlyph size={19} />}
              title={t('selectFree')}
              active={tool === 'select-free'}
              onClick={() => activateTool('select-free')}
            />
          </div>
        </Group>

        <Group label={t('image')}>
          <div className="small-grid">
            <ToolButton icon={<Icon name="resize" />} title={t('resize')} onClick={() => useUI.getState().openDialog('resize')} />
            <ToolButton
              icon={<Icon name="crop" />}
              title={t('crop')}
              disabled={!selection}
              onClick={() => controller.cropToSelection()}
            />
            <button
              ref={rotateBtn}
              className="tool-btn"
              title={t('rotate')}
              onClick={() => setImageMenu({ kind: 'rotate', rect: rotateBtn.current!.getBoundingClientRect() })}
            >
              <Icon name="rotate" />
            </button>
            <button
              ref={flipBtn}
              className="tool-btn"
              title={t('flip')}
              onClick={() => setImageMenu({ kind: 'flip', rect: flipBtn.current!.getBoundingClientRect() })}
            >
              <Icon name="flipH" />
            </button>
            <button
              ref={moreBtn}
              className="tool-btn"
              title={t('more')}
              onClick={() => setImageMore(moreBtn.current!.getBoundingClientRect())}
            >
              <Icon name="more" />
            </button>
          </div>
        </Group>

        <Group label={t('tools')}>
          <div className="small-grid">
            <ToolButton custom={<PencilGlyph size={18} />} title={t('pencil')} active={tool === 'pencil'} onClick={() => activateTool('pencil')} />
            <ToolButton icon={<Icon name="paintBucket" />} title={t('fill')} active={tool === 'fill'} onClick={() => activateTool('fill')} />
            <ToolButton icon={<Icon name="text" />} title={t('text')} active={tool === 'text'} onClick={() => activateTool('text')} />
            <ToolButton icon={<Icon name="eraser" />} title={t('eraser')} active={tool === 'eraser'} onClick={() => activateTool('eraser')} />
            <ToolButton icon={<Icon name="pen" />} title={t('picker')} active={tool === 'picker'} onClick={() => activateTool('picker')} />
            <ToolButton custom={<MagnifierGlyph size={18} />} title={t('magnifier')} active={tool === 'magnifier'} onClick={() => activateTool('magnifier')} />
          </div>
        </Group>

        <Group label={t('brushes')}>
          <div className="split-btn">
            <button
              className="split-main"
              title={t('brush')}
              onClick={() => {
                activateTool('brush')
                setBrushOpen(brushBtn.current?.getBoundingClientRect() ?? null)
              }}
              ref={brushBtn}
            >
              <span className="brush-preview-wrap">
                <BrushThumb type={brushType} color={color1} width={40} height={28} size={Math.min(10, Math.max(2, brushSize))} />
              </span>
            </button>
            <button
              className="split-caret"
              title={brushLabel}
              onClick={() => setBrushOpen(brushBtn.current?.getBoundingClientRect() ?? null)}
            >
              <Icon name="chevronDown" size={12} />
            </button>
          </div>
          <button
            ref={sizeBtn}
            className="size-btn"
            title={`${t('size')}: ${brushSize}px`}
            onClick={() => setSizeOpen(sizeBtn.current?.getBoundingClientRect() ?? null)}
          >
            <span className="size-dots">
              <span className="size-dot" style={{ width: Math.max(2, Math.min(10, brushSize * 0.22)), height: Math.max(2, Math.min(10, brushSize * 0.22)) }} />
                <span className="size-dot" style={{ width: Math.max(2, Math.min(14, brushSize * 0.34)), height: Math.max(2, Math.min(14, brushSize * 0.34)) }} />
              <span className="size-dot" style={{ width: Math.max(2, Math.min(18, brushSize * 0.46)), height: Math.max(2, Math.min(18, brushSize * 0.46)) }} />
            </span>
            <span>{brushSize}px</span>
          </button>
        </Group>

        <Group label={t('shapes')}>
          <div className="shape-gallery">
            {SHAPES.map((shape) => (
              <button
                key={shape.id}
                className={`shape-btn${shapeType === shape.id ? ' active' : ''}`}
                title={useUI.getState().language === 'de' ? shape.de : shape.en}
                onClick={() => {
                  useUI.getState().setShapeType(shape.id)
                  activateTool('shape')
                }}
              >
                <ShapeThumb type={shape.id} color={shapeType === shape.id ? '#0067c0' : '#3d3d3d'} />
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <button
              className={`shape-option${shapeOutline ? '' : ' none'}`}
              title={`${t('outline')}: ${shapeOutline ? t('solid') : t('none')}`}
              onClick={() => useUI.getState().setShapeOutline(!shapeOutline)}
            >
              <span className={`opt-icon${shapeOutline ? '' : ' none'}`} />
            </button>
            <button
              className={`shape-option${shapeFill ? '' : ' none'}`}
              title={`${t('fillStyle')}: ${shapeFill ? t('solid') : t('none')}`}
              onClick={() => useUI.getState().setShapeFill(!shapeFill)}
            >
              <span className={`opt-icon${shapeFill ? ' filled' : ' none'}`} />
            </button>
          </div>
          <button
            ref={shapeSizeBtn}
            className="shape-option"
            title={`${t('thickness')}: ${shapeThickness}px`}
            onClick={() => setShapeSizeOpen(shapeSizeBtn.current?.getBoundingClientRect() ?? null)}
          >
            <span style={{ fontSize: 10, fontWeight: 600 }}>{shapeThickness}</span>
            <span style={{ fontSize: 8, color: '#777' }}>px</span>
          </button>
        </Group>

        <Group label={t('colors')} className="colors-group">
          <div className="color-group">
            <div className="color-pair">
              <button
                className="color-chip primary"
                style={{ background: color1 }}
                title={`${t('color1')}: ${color1}`}
                onClick={() => useUI.getState().openColorDialog(1)}
              />
              <button
                className="color-chip secondary"
                style={{ background: color2 }}
                title={`${t('color2')}: ${color2}`}
                onClick={() => useUI.getState().openColorDialog(2)}
              />
              <button
                className="swap-colors"
                title={t('swap')}
                onClick={(e) => {
                  e.stopPropagation()
                  useUI.getState().swapColors()
                }}
              >
                <svg width="12" height="12" viewBox="0 0 12 12">
                  <path d="M3 2l-2 2 2 2M1 4h7M9 10l2-2-2-2M11 8H4" fill="none" stroke="currentColor" strokeWidth="1.2" />
                </svg>
              </button>
            </div>
            <div className="palette">
              {PALETTE.map((color) => (
                <button
                  key={color}
                  className={`swatch${color1.toLowerCase() === color ? ' selected' : ''}`}
                  style={{ background: color }}
                  title={color}
                  onClick={() => useUI.getState().setColor1(color)}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    useUI.getState().setColor2(color)
                  }}
                />
              ))}
            </div>
            <button
              className="wheel-btn"
              title={t('editColors')}
              onClick={() => useUI.getState().openColorDialog(1)}
            >
              <span className="color-wheel" />
            </button>
          </div>
        </Group>

        <Group label={t('copilot')} className="copilot-group">
          <button
            ref={copilotBtn}
            className="copilot-btn"
            title={t('copilot')}
            onClick={() => setCopilotOpen(copilotBtn.current?.getBoundingClientRect() ?? null)}
          >
            <span className="copilot-orb" />
          </button>
        </Group>

        <div style={{ flex: 1, minWidth: 8 }} />

        <Group label={t('layers')} className="layers-group">
          <button
            className={`big-btn${layersOpen ? ' active' : ''}`}
            title={t('layers')}
            onClick={() => useUI.getState().setLayersOpen(!layersOpen)}
          >
            <Icon name="layer" size={22} />
          </button>
        </Group>
      </div>

      {brushOpen ? (
        <Popover anchor={brushOpen} onClose={() => setBrushOpen(null)} width={232} align="center">
          <div className="brush-list">
            {BRUSHES.map((brush) => (
              <button
                key={brush.id}
                className={`brush-item${brushType === brush.id ? ' active' : ''}`}
                onClick={() => {
                  useUI.getState().setBrushType(brush.id)
                  activateTool('brush')
                  setBrushOpen(null)
                }}
              >
                <BrushThumb type={brush.id} color={color1} width={62} height={28} size={Math.min(9, Math.max(2, brushSize))} />
                <span>{useUI.getState().language === 'de' ? brush.de : brush.en}</span>
              </button>
            ))}
          </div>
        </Popover>
      ) : null}

      {sizeOpen ? (
        <Popover anchor={sizeOpen} onClose={() => setSizeOpen(null)} width={240} align="center">
          <div className="size-popover">
            <div className="size-presets">
              {[1, 3, 5, 8, 12, 20].map((size) => (
                <button
                  key={size}
                  className={`size-preset${brushSize === size ? ' active' : ''}`}
                  onClick={() => useUI.getState().setBrushSize(size)}
                >
                  <span
                    className="size-preset-dot"
                    style={{ width: Math.min(22, 3 + size * 0.7), height: Math.min(22, 3 + size * 0.7) }}
                  />
                  <span>{size}</span>
                </button>
              ))}
            </div>
            <div className="size-slider-row">
              <input
                className="size-slider"
                type="range"
                min={1}
                max={100}
                value={brushSize}
                onChange={(e) => useUI.getState().setBrushSize(Number(e.target.value))}
              />
              <input
                className="input narrow"
                type="number"
                min={1}
                max={200}
                value={brushSize}
                onChange={(e) => useUI.getState().setBrushSize(Number(e.target.value))}
              />
            </div>
          </div>
        </Popover>
      ) : null}

      {shapeSizeOpen ? (
        <Popover anchor={shapeSizeOpen} onClose={() => setShapeSizeOpen(null)} width={220} align="center">
          <div className="size-popover">
            <div className="size-presets">
              {[1, 2, 3, 4, 5, 8].map((size) => (
                <button
                  key={size}
                  className={`size-preset${shapeThickness === size ? ' active' : ''}`}
                  onClick={() => useUI.getState().setShapeThickness(size)}
                >
                  <span className="shape-thickness-line" style={{ height: size }} />
                  <span>{size}</span>
                </button>
              ))}
            </div>
            <div className="size-slider-row">
              <input
                className="size-slider"
                type="range"
                min={1}
                max={20}
                value={shapeThickness}
                onChange={(e) => useUI.getState().setShapeThickness(Number(e.target.value))}
              />
              <input
                className="input narrow"
                type="number"
                min={1}
                max={100}
                value={shapeThickness}
                onChange={(e) => useUI.getState().setShapeThickness(Number(e.target.value))}
              />
            </div>
          </div>
        </Popover>
      ) : null}

      {copilotOpen ? (
        <Popover anchor={copilotOpen} onClose={() => setCopilotOpen(null)} width={300} align="center">
          <div className="copilot-info">
            <span className="copilot-orb large" />
            <div>
              <div className="copilot-info-title">{t('copilotTitle')}</div>
              <div className="copilot-info-text">{t('copilotUnavailable')}</div>
            </div>
          </div>
        </Popover>
      ) : null}

      {imageMenu ? (
        <MenuPopover
          anchor={imageMenu.rect}
          entries={imageEntries}
          onClose={() => setImageMenu(null)}
          minWidth={210}
        />
      ) : null}

      {imageMore ? (
        <MenuPopover
          anchor={imageMore}
          entries={[
            { type: 'item', label: t('canvasSize'), onClick: () => useUI.getState().openDialog('canvas-size') },
            { type: 'item', label: t('invertColors'), onClick: () => controller.invertColors() },
            { type: 'separator' },
            { type: 'item', label: t('properties'), onClick: () => useUI.getState().openDialog('properties') }
          ]}
          onClose={() => setImageMore(null)}
          minWidth={220}
        />
      ) : null}
    </div>
  )
}
