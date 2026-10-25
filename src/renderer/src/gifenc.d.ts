declare module 'gifenc' {
  export interface GifEncoderInstance {
    writeFrame: (
      index: Uint8Array,
      width: number,
      height: number,
      opts?: Record<string, unknown>
    ) => void
    finish: () => void
    bytes: () => Uint8Array
  }
  export function GIFEncoder(opts?: Record<string, unknown>): GifEncoderInstance
  export function quantize(
    rgba: Uint8ClampedArray | Uint8Array,
    maxColors: number,
    opts?: Record<string, unknown>
  ): number[][]
  export function applyPalette(
    rgba: Uint8ClampedArray | Uint8Array,
    palette: number[][],
    format?: string
  ): Uint8Array
}

declare module '*.css'
