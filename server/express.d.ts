// Lo que sessionMiddleware (sessions.ts) añade a cada petición de Express.

import type { Session } from './types.ts'

declare global {
  namespace Express {
    interface Request {
      /** Cookies de la petición, ya decodificadas. */
      cookies: Record<string, string>
      /** Id de la sesión de la cookie, o null si no hay. */
      sessionId: string | null
      /** Sesión válida, o null si no hay (o caducó). */
      session: Session | null
    }
  }
}

export {}
