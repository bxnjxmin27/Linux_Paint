import { controller } from './engine/controller'
import { useUI } from './state/store'
import { useText } from './state/text'
import { askUnsaved } from './state/dialog'
import { type SaveFormat } from './engine/format'
import { decodeAnyFile } from './engine/decode'
import { askPdfPage } from './state/pdfImport'
import { renderPdfPage } from './engine/pdf'
import type { ToolId } from './engine/tools'

export function commitAll(): void {
  const session = useText.getState().session
  if (session) controller.commitText(session, useText.getState().style)
  if (controller.floating) controller.commitFloating()
}

export async function ensureSaved(): Promise<boolean> {
  commitAll()
  if (!controller.dirty) return true
  const choice = await askUnsaved()
  if (choice === 'cancel') return false
  if (choice === 'save') return controller.save()
  return true
}

export async function newDocument(): Promise<void> {
  if (await ensureSaved()) {
    controller.newDocument()
  }
}

export async function openDocument(): Promise<void> {
  if (await ensureSaved()) {
    await controller.openDialog()
  }
}

export async function openRecent(path: string): Promise<void> {
  if (await ensureSaved()) {
    try {
      await controller.openPath(path)
    } catch {
      const files = useUI.getState().recentFiles.filter((f) => f !== path)
      useUI.getState().setRecentFiles(files)
    }
  }
}

export async function saveDocument(): Promise<boolean> {
  commitAll()
  return controller.save()
}

export async function saveAs(format: SaveFormat): Promise<boolean> {
  commitAll()
  return controller.saveAs(format)
}

export async function closeWindow(): Promise<void> {
  if (await ensureSaved()) {
    await window.paint.window.close()
  }
}

export function activateTool(tool: ToolId): void {
  controller.activateTool(tool)
}

export async function openDroppedFile(file: File): Promise<void> {
  if (!(await ensureSaved())) return
  try {
    const path = window.paint.pathForFile(file)
    const data = path ? await window.paint.readFile(path) : new Uint8Array(await file.arrayBuffer())
    await controller.openData(data, file.name, path || null)
  } catch (err) {
    await window.paint.showError('Die Datei konnte nicht geöffnet werden.', String(err))
  }
}

export function importToCanvas(): void {
  void (async () => {
    const result = await window.paint.openImage()
    if (!result) return
    try {
      const decoded = await decodeAnyFile(result.data, result.name)
      if (decoded.kind === 'pdf' && decoded.pdfData && decoded.pageCount) {
        const choice = await askPdfPage({
          data: decoded.pdfData,
          name: result.name,
          pageCount: decoded.pageCount,
          width: decoded.pdfWidth ?? 595,
          height: decoded.pdfHeight ?? 842
        })
        if (!choice) return
        const canvas = await renderPdfPage(decoded.pdfData, choice.page, choice.scale)
        controller.importImage(canvas)
        return
      }
      if (decoded.canvas) controller.importImage(decoded.canvas)
    } catch (err) {
      await window.paint.showError('Die Datei konnte nicht importiert werden.', String(err))
    }
  })()
}
