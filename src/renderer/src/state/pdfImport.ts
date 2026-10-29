import { create } from 'zustand'

export interface PdfImportRequest {
  data: Uint8Array
  name: string
  pageCount: number
  width: number
  height: number
}

export interface PdfImportChoice {
  page: number
  scale: number
}

interface PdfImportState {
  request: PdfImportRequest | null
  page: number
  scale: number
  setPage: (page: number) => void
  setScale: (scale: number) => void
}

export const usePdfImport = create<PdfImportState>((set) => ({
  request: null,
  page: 1,
  scale: 2,
  setPage: (page) => set({ page }),
  setScale: (scale) => set({ scale })
}))

let resolver: ((choice: PdfImportChoice | null) => void) | null = null

export function askPdfPage(request: PdfImportRequest): Promise<PdfImportChoice | null> {
  const current = usePdfImport.getState().request
  if (current && resolver) {
    const old = resolver
    resolver = null
    old(null)
  }
  usePdfImport.setState({ request, page: 1, scale: 2 })
  return new Promise((resolve) => {
    resolver = resolve
  })
}

export function resolvePdfImport(choice: PdfImportChoice | null): void {
  usePdfImport.setState({ request: null })
  const r = resolver
  resolver = null
  r?.(choice)
}
