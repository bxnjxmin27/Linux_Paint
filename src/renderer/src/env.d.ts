import type { PaintApi } from '../../shared/types'

declare global {
  interface Window {
    paint: PaintApi
  }
}

export {}
