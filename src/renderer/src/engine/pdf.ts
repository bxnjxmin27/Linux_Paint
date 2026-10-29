import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { createCanvas, get2d } from './canvas'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

export interface PdfInfo {
  pageCount: number
  width: number
  height: number
}

const MAX_DIMENSION = 9000

function openDocument(data: Uint8Array) {
  return pdfjsLib.getDocument({
    data: data.slice(),
    useSystemFonts: true
  })
}

export async function getPdfInfo(data: Uint8Array): Promise<PdfInfo> {
  const loading = openDocument(data)
  const doc = await loading.promise
  try {
    const page = await doc.getPage(1)
    const viewport = page.getViewport({ scale: 1 })
    return {
      pageCount: doc.numPages,
      width: Math.round(viewport.width),
      height: Math.round(viewport.height)
    }
  } finally {
    await loading.destroy()
  }
}

export async function renderPdfPage(
  data: Uint8Array,
  pageNumber: number,
  scale: number
): Promise<HTMLCanvasElement> {
  const loading = openDocument(data)
  const doc = await loading.promise
  try {
    const page = await doc.getPage(Math.max(1, Math.min(doc.numPages, pageNumber)))
    let viewport = page.getViewport({ scale })
    const longest = Math.max(viewport.width, viewport.height)
    if (longest > MAX_DIMENSION) {
      viewport = page.getViewport({ scale: scale * (MAX_DIMENSION / longest) })
    }
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
    const ctx = get2d(canvas)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({
      canvas,
      viewport
    }).promise
    return canvas
  } finally {
    await loading.destroy()
  }
}

export async function renderPdfPreview(
  data: Uint8Array,
  pageNumber: number,
  maxWidth = 360
): Promise<{ canvas: HTMLCanvasElement; width: number; height: number }> {
  const loading = openDocument(data)
  const doc = await loading.promise
  try {
    const page = await doc.getPage(Math.max(1, Math.min(doc.numPages, pageNumber)))
    const base = page.getViewport({ scale: 1 })
    const scale = Math.min(1.2, maxWidth / base.width)
    const viewport = page.getViewport({ scale })
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
    const ctx = get2d(canvas)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({
      canvas,
      viewport
    }).promise
    return { canvas, width: Math.round(base.width), height: Math.round(base.height) }
  } finally {
    await loading.destroy()
  }
}
