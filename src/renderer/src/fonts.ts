let fontsPromise: Promise<string[]> | null = null

export function getFonts(): Promise<string[]> {
  if (!fontsPromise) {
    fontsPromise = window.paint
      .listFonts()
      .then((fonts) => {
        const set = new Set<string>(['Selawik', 'Segoe UI', 'Noto Sans', 'DejaVu Sans', 'Liberation Sans', ...fonts])
        return [...set].sort((a, b) => a.localeCompare(b, 'de'))
      })
      .catch(() => ['Selawik', 'Segoe UI', 'Noto Sans', 'DejaVu Sans', 'Liberation Sans'])
  }
  return fontsPromise
}
