import { createCanvas, get2d } from './canvas'

export type DecodeKind = 'raster' | 'pdf' | 'svg' | 'heic' | 'tga'

export interface DecodeResult {
  kind: DecodeKind
  canvas?: HTMLCanvasElement
  pdfData?: Uint8Array
  pageCount?: number
  pdfWidth?: number
  pdfHeight?: number
}

function extensionOf(name: string): string {
  return name.split('.').pop()?.toLowerCase() ?? ''
}

function startsWith(data: Uint8Array, text: string): boolean {
  if (data.length < text.length) return false
  for (let i = 0; i < text.length; i++) {
    if (data[i] !== text.charCodeAt(i)) return false
  }
  return true
}

function looksLikeSvg(data: Uint8Array): boolean {
  const head = new TextDecoder().decode(data.slice(0, 2048)).toLowerCase()
  return head.includes('<svg') || (head.startsWith('<?xml') && head.includes('<svg'))
}

function looksLikePdf(data: Uint8Array): boolean {
  return startsWith(data, '%PDF-')
}

function looksLikeHeic(data: Uint8Array): boolean {
  if (data.length < 12) return false
  const brand = String.fromCharCode(data[8], data[9], data[10], data[11]).toLowerCase()
  return ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1'].includes(brand)
}

function parseSvgLength(value: string | null): number | null {
  if (!value) return null
  const match = value.trim().match(/^([0-9.]+)\s*(px|pt|in|cm|mm)?$/i)
  if (!match) return null
  const num = Number.parseFloat(match[1])
  if (!Number.isFinite(num) || num <= 0) return null
  const unit = (match[2] ?? 'px').toLowerCase()
  if (unit === 'pt') return (num * 96) / 72
  if (unit === 'in') return num * 96
  if (unit === 'cm') return (num * 96) / 2.54
  if (unit === 'mm') return (num * 96) / 25.4
  return num
}

async function decodeSvg(data: Uint8Array): Promise<HTMLCanvasElement> {
  const text = new TextDecoder().decode(data)
  const parsed = new DOMParser().parseFromString(text, 'image/svg+xml')
  if (parsed.querySelector('parsererror')) throw new Error('SVG konnte nicht gelesen werden')
  const root = parsed.documentElement
  const viewBox = (root.getAttribute('viewBox') ?? '')
    .trim()
    .split(/[\s,]+/)
    .map(Number)
  const boxWidth = viewBox.length === 4 && viewBox[2] > 0 ? viewBox[2] : 0
  const boxHeight = viewBox.length === 4 && viewBox[3] > 0 ? viewBox[3] : 0
  let width = parseSvgLength(root.getAttribute('width')) ?? boxWidth
  let height = parseSvgLength(root.getAttribute('height')) ?? boxHeight
  if (!width || !height) {
    width = 1000
    height = 1000
  }
  if (boxWidth && boxHeight && (!root.getAttribute('width') || !root.getAttribute('height'))) {
    width = boxWidth
    height = boxHeight
  }
  const longest = Math.max(width, height)
  const scale = Math.max(0.05, Math.min(4, 1600 / longest, 9000 / longest))
  const canvas = createCanvas(Math.round(width * scale), Math.round(height * scale))
  const url = URL.createObjectURL(new Blob([data as BlobPart], { type: 'image/svg+xml' }))
  try {
    const image = new Image()
    image.decoding = 'sync'
    image.src = url
    await image.decode()
    const ctx = get2d(canvas)
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
    return canvas
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function decodeHeic(data: Uint8Array): Promise<HTMLCanvasElement> {
  const mod = (await import('heic2any')) as unknown as {
    default?: (opts: { blob: Blob; toType: string; multiple?: boolean }) => Promise<Blob | Blob[]>
    (opts: { blob: Blob; toType: string; multiple?: boolean }): Promise<Blob | Blob[]>
  }
  const convert = mod.default ?? mod
  const converted = await convert({
    blob: new Blob([data as BlobPart], { type: 'image/heic' }),
    toType: 'image/png',
    multiple: false
  })
  const blob = Array.isArray(converted) ? converted[0] : converted
  const bitmap = await createImageBitmap(blob)
  const canvas = createCanvas(bitmap.width, bitmap.height)
  get2d(canvas).drawImage(bitmap, 0, 0)
  bitmap.close()
  return canvas
}

async function decodeTga(data: Uint8Array): Promise<HTMLCanvasElement> {
  const mod = (await import('tga-js')) as unknown as {
    default: new () => { load(data: Uint8Array): void; getCanvas(): HTMLCanvasElement }
  }
  const TgaLoader = mod.default
  const tga = new TgaLoader()
  tga.load(data)
  return tga.getCanvas()
}

async function decodeRaster(data: Uint8Array, name: string): Promise<HTMLCanvasElement> {
  const ext = extensionOf(name)
  if (ext === 'tif' || ext === 'tiff') {
    const { decodeImageFile } = await import('./format')
    return decodeImageFile(data, name)
  }
  const mime =
    ext === 'jpg' || ext === 'jpeg'
      ? 'image/jpeg'
      : ext === 'webp'
        ? 'image/webp'
        : ext === 'avif'
          ? 'image/avif'
          : ext === 'ico'
            ? 'image/x-icon'
            : ext === 'gif'
              ? 'image/gif'
              : ext === 'bmp'
                ? 'image/bmp'
                : 'application/octet-stream'
  const blob = new Blob([data as BlobPart], { type: mime })
  try {
    const bitmap = await createImageBitmap(blob)
    const canvas = createCanvas(bitmap.width, bitmap.height)
    get2d(canvas).drawImage(bitmap, 0, 0)
    bitmap.close()
    return canvas
  } catch {
    const { decodeImageFile } = await import('./format')
    return decodeImageFile(data, name)
  }
}

export async function decodeAnyFile(data: Uint8Array, name: string): Promise<DecodeResult> {
  const ext = extensionOf(name)
  if (ext === 'pdf' || looksLikePdf(data)) {
    const { getPdfInfo } = await import('./pdf')
    const info = await getPdfInfo(data)
    return {
      kind: 'pdf',
      pdfData: data,
      pageCount: info.pageCount,
      pdfWidth: info.width,
      pdfHeight: info.height
    }
  }
  if (ext === 'svg' || looksLikeSvg(data)) {
    return { kind: 'svg', canvas: await decodeSvg(data) }
  }
  if (ext === 'heic' || ext === 'heif' || looksLikeHeic(data)) {
    try {
      return { kind: 'heic', canvas: await decodeHeic(data) }
    } catch {
      return { kind: 'raster', canvas: await decodeRaster(data, name) }
    }
  }
  if (ext === 'tga') {
    return { kind: 'tga', canvas: await decodeTga(data) }
  }
  return { kind: 'raster', canvas: await decodeRaster(data, name) }
}

export function isSavableSource(name: string): boolean {
  const ext = extensionOf(name)
  return ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif', 'tif', 'tiff'].includes(ext)
}
