import * as UTIF from 'utif'
import { GIFEncoder, quantize, applyPalette } from 'gifenc'
import { createCanvas, get2d, flattenOnWhite, encodeBMP } from './canvas'

export type SaveFormat = 'png' | 'jpg' | 'webp' | 'bmp' | 'gif' | 'tif' | 'pdf'

export const FORMAT_LABEL: Record<SaveFormat, string> = {
  png: 'PNG',
  jpg: 'JPEG',
  webp: 'WebP',
  bmp: 'BMP',
  gif: 'GIF',
  tif: 'TIFF',
  pdf: 'PDF'
}

export function formatFromFilename(name: string): SaveFormat {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'jpg' || ext === 'jpeg') return 'jpg'
  if (ext === 'webp') return 'webp'
  if (ext === 'pdf') return 'pdf'
  if (ext === 'bmp') return 'bmp'
  if (ext === 'gif') return 'gif'
  if (ext === 'tif' || ext === 'tiff') return 'tif'
  return 'png'
}

export function defaultExtension(format: SaveFormat): string {
  return format === 'tif' ? 'tif' : format
}

export async function encodeCanvas(canvas: HTMLCanvasElement, format: SaveFormat, dpi = 96): Promise<Uint8Array> {
  if (format === 'png') {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!blob) throw new Error('PNG encoding failed')
    return new Uint8Array(await blob.arrayBuffer())
  }
  if (format === 'jpg') {
    const flat = flattenOnWhite(canvas)
    const blob = await new Promise<Blob | null>((resolve) => flat.toBlob(resolve, 'image/jpeg', 0.92))
    if (!blob) throw new Error('JPEG encoding failed')
    return new Uint8Array(await blob.arrayBuffer())
  }
  if (format === 'webp') {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.95))
    if (!blob) throw new Error('WebP encoding failed')
    return new Uint8Array(await blob.arrayBuffer())
  }
  if (format === 'bmp') {
    return encodeBMP(canvas)
  }
  if (format === 'pdf') {
    const png = await encodeCanvas(canvas, 'png')
    const { PDFDocument } = await import('pdf-lib')
    const doc = await PDFDocument.create()
    const image = await doc.embedPng(png)
    const widthPt = Math.max(1, Math.min(14400, (canvas.width / Math.max(1, dpi)) * 72))
    const heightPt = Math.max(1, Math.min(14400, (canvas.height / Math.max(1, dpi)) * 72))
    const page = doc.addPage([widthPt, heightPt])
    page.drawImage(image, { x: 0, y: 0, width: widthPt, height: heightPt })
    return await doc.save()
  }
  if (format === 'tif') {
    const width = canvas.width
    const height = canvas.height
    const data = get2d(canvas, true).getImageData(0, 0, width, height).data
    const rgba = new Uint8Array(data.buffer.slice(0))
    const buf = UTIF.encodeImage(rgba, width, height)
    return new Uint8Array(buf)
  }
  // GIF
  const flat = flattenOnWhite(canvas)
  const width = flat.width
  const height = flat.height
  const rgba = get2d(flat, true).getImageData(0, 0, width, height).data
  const palette = quantize(rgba, 256, { format: 'rgb565' })
  const index = applyPalette(rgba, palette, 'rgb565')
  const gif = GIFEncoder()
  gif.writeFrame(index, width, height, { palette, delay: 0 })
  gif.finish()
  return gif.bytes()
}

export async function decodeImageFile(data: Uint8Array, name: string): Promise<HTMLCanvasElement> {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  const isTiff =
    ext === 'tif' ||
    ext === 'tiff' ||
    (data.length > 4 &&
      ((data[0] === 0x49 && data[1] === 0x49 && data[2] === 0x2a && data[3] === 0x00) ||
        (data[0] === 0x4d && data[1] === 0x4d && data[2] === 0x00 && data[3] === 0x2a)))
  if (isTiff) {
    const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
    const ifds = UTIF.decode(buffer as ArrayBuffer)
    if (!ifds.length) throw new Error('TIFF konnte nicht gelesen werden')
    UTIF.decodeImage(buffer as ArrayBuffer, ifds[0])
    const rgba = UTIF.toRGBA8(ifds[0])
    const canvas = createCanvas(ifds[0].width, ifds[0].height)
    const ctx = get2d(canvas, true)
    const img = ctx.createImageData(canvas.width, canvas.height)
    img.data.set(rgba)
    ctx.putImageData(img, 0, 0)
    return canvas
  }
  const mime =
    ext === 'jpg' || ext === 'jpeg'
      ? 'image/jpeg'
      : ext === 'bmp'
        ? 'image/bmp'
        : ext === 'gif'
          ? 'image/gif'
          : ext === 'webp'
            ? 'image/webp'
            : ext === 'avif'
              ? 'image/avif'
              : ext === 'ico'
                ? 'image/x-icon'
                : ext === 'pdf'
                  ? 'application/pdf'
                  : 'image/png'
  const blob = new Blob([data as BlobPart], { type: mime })
  const bitmap = await createImageBitmap(blob)
  const canvas = createCanvas(bitmap.width, bitmap.height)
  get2d(canvas).drawImage(bitmap, 0, 0)
  bitmap.close()
  return canvas
}

export function compositeForExport(canvas: HTMLCanvasElement, format: SaveFormat): HTMLCanvasElement {
  if (format === 'jpg' || format === 'bmp' || format === 'gif') return flattenOnWhite(canvas)
  return canvas
}
