import { useEffect, useState } from 'react'

/** true mientras la media query se cumpla; se actualiza al girar o redimensionar. */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const update = () => setMatches(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [query])
  return matches
}

/** Anchos de móvil: la app pasa a dos vistas, Mes y Día. Igual que en el CSS. */
export const MOBILE_QUERY = '(max-width: 899px)'

/** Puntero táctil: las franjas de slot se crean con un toque, no arrastrando. */
export const TOUCH_QUERY = '(pointer: coarse)'
