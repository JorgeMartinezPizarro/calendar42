/** Flecha circular de refrescar (botones de actualizar la agenda y los slots). */
function RefreshIcon({ size = 14 }: { size?: number }) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9" strokeLinecap="round" />
      <path d="M13.5 2.2v3.3h-3.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default RefreshIcon
