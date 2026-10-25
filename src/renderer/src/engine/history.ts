export interface HistoryEntry {
  label: string
  bytes: number
  undo: () => void
  redo: () => void
}

export class History {
  private undoStack: HistoryEntry[] = []
  private redoStack: HistoryEntry[] = []
  private bytes = 0
  private maxBytes = 320 * 1024 * 1024
  private maxEntries = 40

  get canUndo(): boolean {
    return this.undoStack.length > 0
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0
  }

  get undoCount(): number {
    return this.undoStack.length
  }

  get redoCount(): number {
    return this.redoStack.length
  }

  get lastLabel(): string {
    return this.undoStack[this.undoStack.length - 1]?.label ?? ''
  }

  push(entry: HistoryEntry): void {
    this.undoStack.push(entry)
    this.bytes += entry.bytes
    for (const e of this.redoStack) this.bytes -= e.bytes
    this.redoStack = []
    while (this.undoStack.length > this.maxEntries || (this.bytes > this.maxBytes && this.undoStack.length > 1)) {
      const removed = this.undoStack.shift()
      if (removed) this.bytes -= removed.bytes
    }
  }

  undo(): HistoryEntry | null {
    const entry = this.undoStack.pop()
    if (!entry) return null
    this.bytes -= entry.bytes
    entry.undo()
    this.redoStack.push(entry)
    return entry
  }

  redo(): HistoryEntry | null {
    const entry = this.redoStack.pop()
    if (!entry) return null
    entry.redo()
    this.undoStack.push(entry)
    this.bytes += entry.bytes
    return entry
  }

  clear(): void {
    this.undoStack = []
    this.redoStack = []
    this.bytes = 0
  }
}
