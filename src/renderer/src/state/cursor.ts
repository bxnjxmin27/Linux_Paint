import { create } from 'zustand'

interface CursorState {
  x: number
  y: number
  inside: boolean
  setCursor: (x: number, y: number, inside: boolean) => void
}

export const useCursor = create<CursorState>((set) => ({
  x: 0,
  y: 0,
  inside: false,
  setCursor: (x, y, inside) => set({ x, y, inside })
}))
