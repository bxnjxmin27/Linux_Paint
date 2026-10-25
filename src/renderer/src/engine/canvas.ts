export function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width))
  canvas.height = Math.max(1, Math.round(height))
  return canvas
}

export function get2d(canvas: HTMLCanvasElement, readFrequently = false): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d', { willReadFrequently: readFrequently })
  if (!ctx) throw new Error('Canvas 2D context unavailable')
  return ctx
}

export function cloneCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
  const out = createCanvas(source.width, source.height)
  get2d(out).drawImage(source, 0, 0)
  return out
}

export function clearCanvas(canvas: HTMLCanvasElement): void {
  get2d(canvas).clearRect(0, 0, canvas.width, canvas.height)
}

export interface RGBA {
  r: number
  g: number
  b: number
  a: number
}

export function parseColor(input: string): RGBA {
  const value = input.trim()
  if (value.startsWith('#')) {
    let hex = value.slice(1)
    if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('')
    const num = Number.parseInt(hex, 16)
    if (Number.isFinite(num)) {
      return {
        r: (num >> 16) & 255,
        g: (num >> 8) & 255,
        b: num & 255,
        a: hex.length === 8 ? (num & 255) / 255 : 1
      }
    }
  }
  const m = value.match(/rgba?\(([^)]+)\)/i)
  if (m) {
    const parts = m[1].split(',').map((p) => Number.parseFloat(p.trim()))
    return { r: parts[0] ?? 0, g: parts[1] ?? 0, b: parts[2] ?? 0, a: parts[3] ?? 1 }
  }
  return { r: 0, g: 0, b: 0, a: 1 }
}

export function rgbaToHex(r: number, g: number, b: number): string {
  const h = (n: number): string => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`
}

export function rgbaString(color: RGBA): string {
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`
}

export function hexToRgba(hex: string): [number, number, number, number] {
  const c = parseColor(hex)
  return [c.r, c.g, c.b, Math.round(c.a * 255)]
}

export function flattenOnWhite(source: HTMLCanvasElement): HTMLCanvasElement {
  const out = createCanvas(source.width, source.height)
  const ctx = get2d(out)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, out.width, out.height)
  ctx.drawImage(source, 0, 0)
  return out
}

let checkerCanvas: HTMLCanvasElement | null = null
export function getCheckerCanvas(): HTMLCanvasElement {
  if (checkerCanvas) return checkerCanvas
  const c = createCanvas(16, 16)
  const ctx = get2d(c)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, 16, 16)
  ctx.fillStyle = '#e9e9e9'
  ctx.fillRect(0, 0, 8, 8)
  ctx.fillRect(8, 8, 8, 8)
  checkerCanvas = c
  return c
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/png', quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Canvas encoding failed'))
    }, type, quality)
  })
}

export async function canvasToBytes(canvas: HTMLCanvasElement, type = 'image/png', quality?: number): Promise<Uint8Array> {
  const blob = await canvasToBlob(canvas, type, quality)
  return new Uint8Array(await blob.arrayBuffer())
}

/** Minimal 24-bit BMP encoder (rows bottom-up, BGR, padded to 4 bytes). */
export function encodeBMP(source: HTMLCanvasElement): Uint8Array {
  const wide = flattenOnWhite(source)
  const imageData = get2d(wide, true).getImageData(0, 0, wide.width, wide.height)
  const width = wide.width
  const height = wide.height
  const rowSize = Math.floor((24 * width + 31) / 32) * 4
  const pixelBytes = rowSize * height
  const fileSize = 14 + 40 + pixelBytes
  const out = new Uint8Array(fileSize)
  const view = new DataView(out.buffer)
  out[0] = 0x42
  out[1] = 0x4d
  view.setUint32(2, fileSize, true)
  view.setUint32(10, 54, true)
  view.setUint32(14, 40, true)
  view.setInt32(18, width, true)
  view.setInt32(22, height, true)
  view.setUint16(26, 1, true)
  view.setUint16(28, 24, true)
  view.setUint32(34, pixelBytes, true)
  view.setInt32(38, 2835, true)
  view.setInt32(42, 2835, true)
  const data = imageData.data
  let offset = 54
  for (let y = height - 1; y >= 0; y--) {
    const row = y * width * 4
    for (let x = 0; x < width; x++) {
      const i = row + x * 4
      out[offset++] = data[i + 2]
      out[offset++] = data[i + 1]
      out[offset++] = data[i]
    }
    offset += rowSize - width * 3
  }
  return out
}

export function invertImage(canvas: HTMLCanvasElement): void {
  const ctx = get2d(canvas, true)
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue
    d[i] = 255 - d[i]
    d[i + 1] = 255 - d[i + 1]
    d[i + 2] = 255 - d[i + 2]
  }
  ctx.putImageData(img, 0, 0)
}

export function makeThumbnail(canvas: HTMLCanvasElement, maxW = 52, maxH = 34): string {
  const out = createCanvas(maxW, maxH)
  const ctx = get2d(out)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, maxW, maxH)
  ctx.fillStyle = '#e9e9e9'
  for (let y = 0; y < maxH; y += 6) {
    for (let x = 0; x < maxW; x += 6) {
      if (((x / 6 + y / 6) | 0) % 2 === 0) ctx.fillRect(x, y, 6, 6)
    }
  }
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(canvas, 0, 0, maxW, maxH)
  return out.toDataURL('image/png')
}
