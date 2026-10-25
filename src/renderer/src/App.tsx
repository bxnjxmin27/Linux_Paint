import { useEffect } from 'react'
import { TitleBar } from './components/TitleBar'
import { CommandBar } from './components/CommandBar'
import { Toolbar } from './components/Toolbar'
import { TextBar } from './components/TextBar'
import { CanvasView } from './components/CanvasView'
import { LayersPane } from './components/LayersPane'
import { StatusBar } from './components/StatusBar'
import { Dialogs } from './components/Dialogs'
import { ResizeHandles } from './components/ResizeHandles'
import { controller } from './engine/controller'
import { useUI } from './state/store'
import { useText } from './state/text'
import { closeWindow, newDocument, openDocument, saveAs, saveDocument, openDroppedFile, ensureSaved } from './actions'

export default function App(): React.ReactElement {
  const tool = useUI((s) => s.tool)
  const layersOpen = useUI((s) => s.layersOpen)
  const language = useUI((s) => s.language)

  useEffect(() => {
    void document.fonts.load('400 12px Selawik')
    void document.fonts.load('700 12px Selawik')
    controller.initialize()
  }, [])

  useEffect(() => {
    controller.syncMeta()
  }, [language])

  useEffect(() => {
    let closing = false
    return window.paint.window.onCloseRequested(() => {
      if (closing) return
      closing = true
      void closeWindow().finally(() => {
        closing = false
      })
    })
  }, [])

  useEffect(() => {
    let busy = false
    return window.paint.onOpenFile((path) => {
      if (busy) return
      busy = true
      void (async () => {
        if (await ensureSaved()) {
          try {
            await controller.openPath(path)
          } catch {
            useUI.getState().openDialog('about')
          }
        }
        busy = false
      })()
    })
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement | null
      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target?.isContentEditable ?? false)
      const ctrl = e.ctrlKey || e.metaKey
      const key = e.key
      const allowWhileTyping = ctrl && ['s', 'o', 'n', 'p'].includes(key.toLowerCase())
      if (typing && !allowWhileTyping) return

      if (ctrl) {
        const k = key.toLowerCase()
        if (k === 'n' && !e.shiftKey) {
          e.preventDefault()
          void newDocument()
          return
        }
        if (k === 'o') {
          e.preventDefault()
          void openDocument()
          return
        }
        if (k === 's') {
          e.preventDefault()
          if (e.shiftKey) void saveAs(controller.format)
          else void saveDocument()
          return
        }
        if (k === 'p') {
          e.preventDefault()
          void controller.print()
          return
        }
        if (k === 'w') {
          e.preventDefault()
          useUI.getState().openDialog('resize')
          return
        }
        if (k === 'e') {
          e.preventDefault()
          useUI.getState().openDialog('properties')
          return
        }
        if (k === 'z') {
          e.preventDefault()
          if (e.shiftKey) controller.redo()
          else controller.undo()
          return
        }
        if (k === 'y') {
          e.preventDefault()
          controller.redo()
          return
        }
        if (k === 'x') {
          e.preventDefault()
          void controller.cutSelection()
          return
        }
        if (k === 'c') {
          e.preventDefault()
          void controller.copySelection()
          return
        }
        if (k === 'v') {
          e.preventDefault()
          void controller.paste()
          return
        }
        if (k === 'a') {
          e.preventDefault()
          controller.selectAll()
          return
        }
        if (k === 'i' && e.shiftKey) {
          e.preventDefault()
          controller.invertColors()
          return
        }
        if (k === 'r') {
          e.preventDefault()
          useUI.getState().toggleRulers()
          return
        }
        if (k === 'g') {
          e.preventDefault()
          useUI.getState().toggleGrid()
          return
        }
        if (k === '0') {
          e.preventDefault()
          useUI.getState().zoomTo(1)
          return
        }
        if (key === 'PageUp') {
          e.preventDefault()
          useUI.getState().zoomStep(1)
          return
        }
        if (key === 'PageDown') {
          e.preventDefault()
          useUI.getState().zoomStep(-1)
          return
        }
        if (key === '+' || key === '=') {
          e.preventDefault()
          if (useUI.getState().tool === 'shape') useUI.getState().setShapeThickness(useUI.getState().shapeThickness + 1)
          else useUI.getState().setBrushSize(useUI.getState().brushSize + 1)
          return
        }
        if (key === '-') {
          e.preventDefault()
          if (useUI.getState().tool === 'shape') useUI.getState().setShapeThickness(useUI.getState().shapeThickness - 1)
          else useUI.getState().setBrushSize(useUI.getState().brushSize - 1)
          return
        }
        return
      }

      if (typing) return

      if (key === 'Delete') {
        e.preventDefault()
        controller.deleteSelection()
        return
      }
      if (key === 'Escape') {
        if (useText.getState().session) {
          useText.getState().close()
          controller.repaint?.()
        } else if (controller.floating) {
          controller.cancelFloating()
        } else {
          controller.clearSelection()
        }
        return
      }
      if (key === 'ArrowLeft' || key === 'ArrowRight' || key === 'ArrowUp' || key === 'ArrowDown') {
        if (controller.floating || controller.selection) {
          e.preventDefault()
          const step = e.shiftKey ? 10 : 1
          if (key === 'ArrowLeft') controller.nudgeSelection(-step, 0)
          if (key === 'ArrowRight') controller.nudgeSelection(step, 0)
          if (key === 'ArrowUp') controller.nudgeSelection(0, -step)
          if (key === 'ArrowDown') controller.nudgeSelection(0, step)
          return
        }
      }
      if (key === 'F11') {
        e.preventDefault()
        if (document.fullscreenElement) void document.exitFullscreen()
        else void document.documentElement.requestFullscreen()
        return
      }
      if (key === 'F10') {
        e.preventDefault()
      }
      if (e.altKey && key === 'F4') {
        e.preventDefault()
        void closeWindow()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div
      className="app"
      onDragOver={(e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'copy'
      }}
      onDrop={(e) => {
        e.preventDefault()
        const file = e.dataTransfer.files?.[0]
        if (file) void openDroppedFile(file)
      }}
    >
      <TitleBar />
      <CommandBar />
      <Toolbar />
      {tool === 'text' ? <TextBar /> : null}
      <div className="workspace">
        <CanvasView />
        {layersOpen ? <LayersPane /> : null}
      </div>
      <StatusBar />
      <Dialogs />
      <ResizeHandles />
    </div>
  )
}
