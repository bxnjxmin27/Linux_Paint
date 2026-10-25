import { useUI } from './store'

export type UnsavedChoice = 'save' | 'discard' | 'cancel'

let resolver: ((choice: UnsavedChoice) => void) | null = null

export function askUnsaved(): Promise<UnsavedChoice> {
  useUI.getState().openDialog('unsaved')
  return new Promise((resolve) => {
    resolver = resolve
  })
}

export function resolveUnsaved(choice: UnsavedChoice): void {
  useUI.getState().closeDialog()
  const r = resolver
  resolver = null
  r?.(choice)
}
