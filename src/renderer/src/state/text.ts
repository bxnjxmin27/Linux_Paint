import { create } from 'zustand'

export interface TextStyle {
  family: string
  size: number
  bold: boolean
  italic: boolean
  underline: boolean
  align: 'left' | 'center' | 'right'
  color: string
  background: boolean
}

export interface TextSession {
  x: number
  y: number
  w: number
  h: number
  text: string
}

interface TextState {
  session: TextSession | null
  style: TextStyle
  start: (session: TextSession) => void
  update: (patch: Partial<TextSession>) => void
  setStyle: (patch: Partial<TextStyle>) => void
  close: () => void
}

export const useText = create<TextState>((set) => ({
  session: null,
  style: {
    family: 'Selawik',
    size: 12,
    bold: false,
    italic: false,
    underline: false,
    align: 'left',
    color: '#000000',
    background: false
  },
  start: (session) => set({ session }),
  update: (patch) => set((s) => (s.session ? { session: { ...s.session, ...patch } } : s)),
  setStyle: (patch) => set((s) => ({ style: { ...s.style, ...patch } })),
  close: () => set({ session: null })
}))
