import { controller } from './engine/controller'
import { useUI } from './state/store'
import { useText } from './state/text'
import { askUnsaved } from './state/dialog'
import { decodeImageFile, type SaveFormat } from './engine/format'
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
    const canvas = await decodeImageFile(data, file.name)
    controller.loadCanvas(canvas, path || null, file.name)
  } catch {
    useUI.getState().openDialog('about')
  }
}

export function importToCanvas(): void {
  void (async () => {
    const result = await window.paint.openImage()
    if (!result) return
    const canvas = await decodeImageFile(result.data, result.name)
    controller.importImage(canvas)
  })()
}
