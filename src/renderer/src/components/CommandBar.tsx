import { useRef, useState } from 'react'
import { useUI } from '../state/store'
import { useT } from '../i18n'
import { Icon } from './Icon'
import { MenuPopover, type MenuEntry } from './Menus'
import {
  closeWindow,
  newDocument,
  openDocument,
  openRecent,
  saveAs,
  saveDocument,
  importToCanvas
} from '../actions'
import { controller } from '../engine/controller'
import type { SaveFormat } from '../engine/format'

type MenuId = 'file' | 'edit' | 'view'

export function CommandBar(): React.ReactElement {
  const t = useT()
  const [open, setOpen] = useState<{ id: MenuId; rect: DOMRect } | null>(null)
  const fileRef = useRef<HTMLButtonElement>(null)
  const editRef = useRef<HTMLButtonElement>(null)
  const viewRef = useRef<HTMLButtonElement>(null)
  const undoCount = useUI((s) => s.undoCount)
  const redoCount = useUI((s) => s.redoCount)
  const recent = useUI((s) => s.recentFiles)
  const showRulers = useUI((s) => s.showRulers)
  const showGrid = useUI((s) => s.showGrid)
  const showStatus = useUI((s) => s.showStatus)
  const language = useUI((s) => s.language)

  const toggle = (id: MenuId, ref: React.RefObject<HTMLButtonElement | null>): void => {
    if (open?.id === id) {
      setOpen(null)
      return
    }
    const rect = ref.current?.getBoundingClientRect()
    if (rect) setOpen({ id, rect })
  }

  const close = (): void => setOpen(null)

  const fileEntries: MenuEntry[] = [
    { type: 'item', label: t('new'), shortcut: 'Ctrl+N', onClick: () => void newDocument() },
    { type: 'item', label: t('open'), icon: 'folder', shortcut: 'Ctrl+O', onClick: () => void openDocument() },
    { type: 'separator' },
    { type: 'item', label: t('save'), icon: 'save', shortcut: 'Ctrl+S', onClick: () => void saveDocument() },
    {
      type: 'submenu',
      label: t('saveAs'),
      icon: 'arrowDown',
      items: (['png', 'jpg', 'bmp', 'gif', 'tif'] as SaveFormat[]).map((format) => ({
        type: 'item' as const,
        label: format === 'jpg' ? 'JPEG' : format === 'tif' ? 'TIFF' : format.toUpperCase(),
        onClick: () => void saveAs(format)
      }))
    },
    { type: 'item', label: t('importCanvas'), icon: 'image', onClick: importToCanvas },
    { type: 'separator' },
    {
      type: 'submenu',
      label: t('recent'),
      icon: 'folder',
      items:
        recent.length === 0
          ? [{ type: 'item', label: t('noRecent'), disabled: true, onClick: () => undefined }]
          : recent.map((path) => ({
              type: 'item' as const,
              label: path.split('/').pop() ?? path,
              onClick: () => void openRecent(path)
            }))
    },
    { type: 'separator' },
    { type: 'item', label: t('print'), icon: 'print', shortcut: 'Ctrl+P', onClick: () => void controller.print() },
    {
      type: 'item',
      label: t('properties'),
      icon: 'info',
      shortcut: 'Ctrl+E',
      onClick: () => useUI.getState().openDialog('properties')
    },
    { type: 'separator' },
    { type: 'item', label: t('about'), icon: 'info', onClick: () => useUI.getState().openDialog('about') },
    { type: 'item', label: t('exit'), shortcut: 'Alt+F4', onClick: () => void closeWindow() }
  ]

  const editEntries: MenuEntry[] = [
    {
      type: 'item',
      label: t('undo'),
      icon: 'arrowUndo',
      shortcut: 'Ctrl+Z',
      disabled: undoCount === 0,
      onClick: () => controller.undo()
    },
    {
      type: 'item',
      label: t('redo'),
      icon: 'arrowRedo',
      shortcut: 'Ctrl+Y',
      disabled: redoCount === 0,
      onClick: () => controller.redo()
    },
    { type: 'separator' },
    { type: 'item', label: t('cut'), icon: 'cut', shortcut: 'Ctrl+X', onClick: () => void controller.cutSelection() },
    { type: 'item', label: t('copy'), icon: 'copy', shortcut: 'Ctrl+C', onClick: () => void controller.copySelection() },
    { type: 'item', label: t('paste'), icon: 'clipboard', shortcut: 'Ctrl+V', onClick: () => void controller.paste() },
    { type: 'item', label: t('delete'), icon: 'delete', shortcut: 'Del', onClick: () => controller.deleteSelection() },
    { type: 'separator' },
    { type: 'item', label: t('selectAll'), shortcut: 'Ctrl+A', onClick: () => controller.selectAll() },
    { type: 'item', label: t('deselect'), onClick: () => controller.clearSelection() },
    { type: 'item', label: t('invertSelection'), onClick: () => controller.invertSelection() }
  ]

  const viewEntries: MenuEntry[] = [
    { type: 'item', label: t('zoomIn'), icon: 'zoomIn', shortcut: 'Ctrl+PageUp', onClick: () => useUI.getState().zoomStep(1) },
    { type: 'item', label: t('zoomOut'), icon: 'zoomOut', shortcut: 'Ctrl+PageDown', onClick: () => useUI.getState().zoomStep(-1) },
    { type: 'item', label: t('actualSize'), icon: 'zoomFit', shortcut: 'Ctrl+0', onClick: () => useUI.getState().zoomTo(1) },
    { type: 'item', label: t('fitWindow'), icon: 'zoomFit', onClick: () => useUI.getState().fitToWindow() },
    { type: 'separator' },
    {
      type: 'item',
      label: t('fullscreen'),
      icon: 'fullscreen',
      shortcut: 'F11',
      onClick: () => {
        if (document.fullscreenElement) void document.exitFullscreen()
        else void document.documentElement.requestFullscreen()
      }
    },
    { type: 'item', label: t('rulers'), icon: 'ruler', shortcut: 'Ctrl+R', checked: showRulers, onClick: () => useUI.getState().toggleRulers() },
    { type: 'item', label: t('grid'), icon: 'grid', shortcut: 'Ctrl+G', checked: showGrid, onClick: () => useUI.getState().toggleGrid() },
    { type: 'item', label: t('statusBar'), checked: showStatus, onClick: () => useUI.getState().toggleStatus() },
    { type: 'separator' },
    {
      type: 'submenu',
      label: t('language'),
      items: [
        {
          type: 'item',
          label: t('german'),
          checked: language === 'de',
          onClick: () => useUI.getState().setLanguage('de')
        },
        {
          type: 'item',
          label: t('english'),
          checked: language === 'en',
          onClick: () => useUI.getState().setLanguage('en')
        }
      ]
    }
  ]

  const entries = open?.id === 'file' ? fileEntries : open?.id === 'edit' ? editEntries : viewEntries

  return (
    <div className="commandbar">
      <button ref={fileRef} className={`menu-btn${open?.id === 'file' ? ' open' : ''}`} onClick={() => toggle('file', fileRef)}>
        {t('file')}
      </button>
      <button ref={editRef} className={`menu-btn${open?.id === 'edit' ? ' open' : ''}`} onClick={() => toggle('edit', editRef)}>
        {t('edit')}
      </button>
      <button ref={viewRef} className={`menu-btn${open?.id === 'view' ? ' open' : ''}`} onClick={() => toggle('view', viewRef)}>
        {t('view')}
      </button>
      <div className="command-actions">
        <button className="icon-btn" title={t('save')} onClick={() => void saveDocument()}>
          <Icon name="save" size={18} />
        </button>
        <button className="icon-btn" title={t('undo')} disabled={undoCount === 0} onClick={() => controller.undo()}>
          <Icon name="arrowUndo" size={18} />
        </button>
        <button className="icon-btn" title={t('redo')} disabled={redoCount === 0} onClick={() => controller.redo()}>
          <Icon name="arrowRedo" size={18} />
        </button>
      </div>
      <div className="commandbar-spacer" />
      {open ? (
        <MenuPopover anchor={open.rect} entries={entries} onClose={close} minWidth={open.id === 'file' ? 280 : 250} />
      ) : null}
    </div>
  )
}
