/// <reference types="vite/client" />

import 'react'

declare module 'react' {
  // Variables CSS en línea (style={{ '--ev-color': ... }}): el color de cada
  // elemento se pasa así a su CSS.
  interface CSSProperties {
    [variable: `--${string}`]: string | number | undefined
  }
}
