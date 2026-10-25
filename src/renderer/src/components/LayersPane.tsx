import { useState } from 'react'
import { useUI } from '../state/store'
import { useT } from '../i18n'
import { Icon } from './Icon'
import { ContextMenu, type MenuEntry } from './Menus'
import { controller } from '../engine/controller'

export function LayersPane(): React.ReactElement | null {
  const t = useT()
  const open = useUI((s) => s.layersOpen)
  const layers = useUI((s) => s.layers)
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [menu, setMenu] = useState<{ x: number; y: number; id: string } | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)

  if (!open) return null

  const activeLayer = controller.doc.activeLayer
  const activeIndex = controller.doc.activeIndex
  const total = controller.doc.layers.length

  const entryList = (): MenuEntry[] => [
    { type: 'item', label: t('duplicateLayer'), icon: 'copyAdd', onClick: () => controller.duplicateLayer() },
    {
      type: 'item',
      label: t('mergeDown'),
      icon: 'merge',
      disabled: activeIndex <= 0,
      onClick: () => controller.mergeDown()
    },
    { type: 'separator' },
    {
      type: 'item',
      label: t('moveUp'),
      disabled: activeIndex >= total - 1,
      onClick: () => controller.moveLayer(activeLayer.id, activeIndex + 1)
    },
    {
      type: 'item',
      label: t('moveDown'),
      disabled: activeIndex <= 0,
      onClick: () => controller.moveLayer(activeLayer.id, activeIndex - 1)
    },
    { type: 'separator' },
    {
      type: 'item',
      label: t('deleteLayer'),
      icon: 'delete',
      disabled: total <= 1,
      onClick: () => controller.deleteLayer()
    }
  ]

  return (
    <aside className="layers-pane">
      <div className="layers-header">
        <span className="layers-title">{t('layers')}</span>
        <button className="icon-btn" title={t('addLayer')} onClick={() => controller.addLayer()}>
          <Icon name="add" size={17} />
        </button>
        <button className="icon-btn" title={t('close')} onClick={() => useUI.getState().setLayersOpen(false)}>
          <Icon name="dismiss" size={16} />
        </button>
      </div>
      <div className="layers-list">
        {layers.map((layer, index) => (
          <div
            key={layer.id}
            className={`layer-row${layer.active ? ' active' : ''}${dragOver === layer.id ? ' drag-over' : ''}`}
            onClick={() => controller.setActiveLayer(layer.id)}
            draggable
            onDragStart={() => setDragId(layer.id)}
            onDragEnd={() => {
              setDragId(null)
              setDragOver(null)
            }}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(layer.id)
            }}
            onDragLeave={() => setDragOver((v) => (v === layer.id ? null : v))}
            onDrop={(e) => {
              e.preventDefault()
              if (dragId && dragId !== layer.id) {
                const target = controller.doc.layers.length - 1 - index
                controller.moveLayer(dragId, target)
              }
              setDragId(null)
              setDragOver(null)
            }}
          >
            <button
              className="layer-eye"
              title={layer.visible ? t('showHide') : t('showHide')}
              onClick={(e) => {
                e.stopPropagation()
                controller.toggleLayerVisible(layer.id)
              }}
            >
              <Icon name={layer.visible ? 'eye' : 'eyeOff'} size={15} />
            </button>
            <div className="layer-thumb">
              <img src={layer.thumbnail} alt="" draggable={false} />
            </div>
            <div className="layer-info">
              {editing === layer.id ? (
                <input
                  className="layer-name-input"
                  value={draft}
                  autoFocus
                  onChange={(e) => setDraft(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onBlur={() => {
                    controller.renameLayer(layer.id, draft)
                    setEditing(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      controller.renameLayer(layer.id, draft)
                      setEditing(null)
                    }
                    if (e.key === 'Escape') setEditing(null)
                  }}
                />
              ) : (
                <span
                  className="layer-name"
                  onDoubleClick={(e) => {
                    e.stopPropagation()
                    setDraft(layer.name)
                    setEditing(layer.id)
                  }}
                  title={layer.name}
                >
                  {layer.name}
                </span>
              )}
            </div>
            <button
              className="layer-menu-btn"
              title="..."
              onClick={(e) => {
                e.stopPropagation()
                controller.setActiveLayer(layer.id)
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                setMenu({ x: rect.left, y: rect.bottom, id: layer.id })
              }}
            >
              <Icon name="more" size={15} />
            </button>
          </div>
        ))}
      </div>
      <div className="layers-footer">
        <button className="icon-btn" title={t('addLayer')} onClick={() => controller.addLayer()}>
          <Icon name="add" size={16} />
        </button>
        <button className="icon-btn" title={t('duplicateLayer')} onClick={() => controller.duplicateLayer()}>
          <Icon name="copyAdd" size={16} />
        </button>
        <button className="icon-btn" title={t('mergeDown')} disabled={activeIndex <= 0} onClick={() => controller.mergeDown()}>
          <Icon name="merge" size={16} />
        </button>
        <div style={{ flex: 1 }} />
        <button className="icon-btn" title={t('deleteLayer')} disabled={total <= 1} onClick={() => controller.deleteLayer()}>
          <Icon name="delete" size={16} />
        </button>
      </div>
      {menu ? <ContextMenu x={menu.x} y={menu.y} entries={entryList()} onClose={() => setMenu(null)} /> : null}
    </aside>
  )
}
