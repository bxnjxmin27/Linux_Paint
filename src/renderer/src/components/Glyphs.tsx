export function MinimizeGlyph(): React.ReactElement {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <path d="M0 5.5h10" stroke="currentColor" strokeWidth="1" />
    </svg>
  )
}

export function MaximizeGlyph(): React.ReactElement {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="1" />
    </svg>
  )
}

export function RestoreGlyph(): React.ReactElement {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <rect x="2.5" y="0.5" width="7" height="7" fill="none" stroke="currentColor" strokeWidth="1" />
      <rect x="0.5" y="2.5" width="7" height="7" fill="#f3f3f3" stroke="currentColor" strokeWidth="1" />
    </svg>
  )
}

export function CloseGlyph(): React.ReactElement {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <path d="M0.5 0.5l9 9M9.5 0.5l-9 9" stroke="currentColor" strokeWidth="1" />
    </svg>
  )
}

export function PaintLogo({ size = 18 }: { size?: number }): React.ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <linearGradient id="paint-logo-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1e88e5" />
          <stop offset="1" stopColor="#0b5cad" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="22" height="22" rx="5" fill="url(#paint-logo-bg)" />
      <path
        d="M6.2 16.7c-1.4-.4-2.2-1.7-2.2-3.1 0-3.4 3-6.1 6.8-6.1 3.2 0 5.7 1.9 5.7 4.4 0 1.9-1.6 3.4-3.7 3.4h-1.2c-.7 0-1.2.5-1.2 1.1 0 .3.1.5.3.8.4.5.1 1.2-.5 1.2-.2 0-.4 0-.6-.1z"
        fill="#fff"
      />
      <circle cx="8.2" cy="9.6" r="1.05" fill="#ffd54f" />
      <circle cx="11.6" cy="8.2" r="1.05" fill="#ef5350" />
      <circle cx="15" cy="9.6" r="1.05" fill="#66bb6a" />
      <circle cx="16" cy="13" r="1.05" fill="#42a5f5" />
    </svg>
  )
}

export function RectSelectGlyph({ size = 18 }: { size?: number }): React.ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <rect x="2.5" y="3.5" width="15" height="13" fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="3 2" />
      <rect x="1.5" y="2.5" width="3" height="3" fill="#fff" stroke="currentColor" strokeWidth="1" />
      <rect x="15.5" y="2.5" width="3" height="3" fill="#fff" stroke="currentColor" strokeWidth="1" />
      <rect x="1.5" y="14.5" width="3" height="3" fill="#fff" stroke="currentColor" strokeWidth="1" />
      <rect x="15.5" y="14.5" width="3" height="3" fill="#fff" stroke="currentColor" strokeWidth="1" />
    </svg>
  )
}

export function LassoGlyph({ size = 18 }: { size?: number }): React.ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M10 2.2c4.1 0 7.4 2.4 7.4 5.4 0 2.7-2.6 4.9-6 5.3-.6.1-1.1.2-1.1.8 0 .4.4.7.4 1.2 0 .6-.5 1.1-1.1 1.1-.8 0-1.4-.6-1.4-1.4 0-.7.4-1.2.4-1.7 0-.3-.2-.5-.6-.5C4.5 12.1 2.6 10.2 2.6 7.6c0-3 3.3-5.4 7.4-5.4z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <circle cx="9.6" cy="14.9" r="1.5" fill="none" stroke="currentColor" strokeWidth="1" />
    </svg>
  )
}

export function PencilGlyph({ size = 18 }: { size?: number }): React.ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <path d="M12.8 2.7l4.5 4.5-9.2 9.2-4.9 1.1 1.1-4.9 8.5-9.9z" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M11.2 4.6l4.2 4.2M3.9 15.6l4.2-1.1-3.1-3.1-1.1 4.2z" fill="none" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  )
}

export function MagnifierGlyph({ size = 18 }: { size?: number }): React.ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="8.5" cy="8.5" r="5.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12.5 12.5l4.5 4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}

export function PaletteWheel({ size = 22 }: { size?: number }): React.ReactElement {
  return (
    <span className="color-wheel" style={{ width: size, height: size }} />
  )
}

export function ChevronRightGlyph(): React.ReactElement {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <path d="M3 1.5L7 5 3 8.5" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}
