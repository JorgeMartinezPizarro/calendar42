// Mensajes que la API propia devuelve al usuario, en los dos idiomas de la app.
// El frontend manda su idioma en Accept-Language; sin él (curl, pruebas) se
// responde en español. Los logs del servidor siguen en español.

import type { Request } from 'express'

export type Lang = 'es' | 'en'

const es = {
  originNotAllowed: 'Origen no permitido',
  notLoggedIn: 'No has iniciado sesión',
  sessionExpired: 'La sesión ha caducado, vuelve a iniciar sesión',
  overlaps: (names: string) => `Se solapa con ${names}`,
  missingScope: (reason: string) =>
    `La sesión no tiene el scope que pide la intra (${reason}). Actívalo en la app OAuth de la intra, cierra sesión y vuelve a entrar.`,
  notAuthorized: (status: number | undefined, reason: string, hint: string) =>
    `La intra no autoriza esta operación con tu cuenta (${status}: ${reason}).${hint ? ` ${hint}` : ''}`,
  notAccepted: (reason: string) => `La intra no ha aceptado la operación: ${reason}`,
  oauthNotConfigured: 'Faltan FT_CLIENT_ID y FT_CLIENT_SECRET en el servidor (.env)',
  invalidRange: 'Parámetros from/to inválidos (usa fechas ISO)',
  toBeforeFrom: '"to" debe ser posterior a "from"',
  projectsForbidden: 'La intra no deja leer tus proyectos con esta sesión. Cierra sesión y vuelve a entrar.',
  invalidEventId: 'Id de evento inválido',
  hintEventSignup:
    'Puede que el evento no admita inscripciones para tu cursus o campus, o que la API no deje a los estudiantes apuntarse. Comprueba si puedes apuntarte a ese mismo evento desde la web de la intra.',
  invalidSlotRange: 'Franja inválida: hacen falta beginAt y endAt (ISO), con fin posterior al inicio',
  slotGap: (minutes: number) => `Deja ${minutes} minutos libres entre slots: queda pegado a otro slot`,
  slotIdsRequired: 'Hacen falta los ids de los bloques del slot',
  invalidProjectId: 'Id de proyecto inválido',
  hintProjectSlots: 'Puede que la API no deje a los estudiantes consultar los slots de un proyecto.',
  bookingParamsRequired: 'Hacen falta projectId, teamId y beginAt (ISO)',
  hintBooking:
    'La reserva de correcciones puede estar reservada al personal en la API; en ese caso hay que agendarla desde la intra.',
  invalidExamId: 'Id de examen inválido',
  examSignupDisabled:
    'Inscripción a exámenes desactivada: el rol de estudiante no alcanza, se requieren permisos del staff.',
  // Errores que nacen en intra.ts (HttpError.code).
  tokenRejected: (status: number) => `La intra rechazó la petición de token (${status})`,
  intraUnreachable: (path: string) => `La intra no respondió en ${path}`,
  intraUnavailable: (status: number) => `La intra no está disponible ahora mismo (${status})`,
  intraError: (path: string, status: number, reason: string) =>
    `Error de la intra en ${path} (${status}${reason ? `: ${reason}` : ''})`,
  notSubscribed: 'No estás inscrito en este evento',
  noScale: 'El proyecto no tiene escala de evaluación en la intra',
}

export type Messages = typeof es

const en: Messages = {
  originNotAllowed: 'Origin not allowed',
  notLoggedIn: 'You are not logged in',
  sessionExpired: 'Your session has expired, please log in again',
  overlaps: (names) => `Overlaps with ${names}`,
  missingScope: (reason) =>
    `The session lacks the scope the intra requires (${reason}). Enable it in the intra OAuth app, log out and log in again.`,
  notAuthorized: (status, reason, hint) =>
    `The intra does not allow this action for your account (${status}: ${reason}).${hint ? ` ${hint}` : ''}`,
  notAccepted: (reason) => `The intra did not accept the action: ${reason}`,
  oauthNotConfigured: 'FT_CLIENT_ID and FT_CLIENT_SECRET are missing on the server (.env)',
  invalidRange: 'Invalid from/to parameters (use ISO dates)',
  toBeforeFrom: '"to" must be after "from"',
  projectsForbidden: 'The intra does not let this session read your projects. Log out and log in again.',
  invalidEventId: 'Invalid event id',
  hintEventSignup:
    'The event may not accept sign-ups for your cursus or campus, or the API may not let students sign up. Check whether you can sign up for the same event on the intra website.',
  invalidSlotRange: 'Invalid time range: beginAt and endAt (ISO) are required, with the end after the start',
  slotGap: (minutes) => `Leave ${minutes} free minutes between slots: this one touches another slot`,
  slotIdsRequired: 'The ids of the slot blocks are required',
  invalidProjectId: 'Invalid project id',
  hintProjectSlots: 'The API may not let students read the slots of a project.',
  bookingParamsRequired: 'projectId, teamId and beginAt (ISO) are required',
  hintBooking: 'Booking evaluations may be restricted to staff in the API; if so, book it on the intra.',
  invalidExamId: 'Invalid exam id',
  examSignupDisabled: 'Exam sign-up is disabled: the student role is not enough, staff permissions are required.',
  tokenRejected: (status) => `The intra rejected the token request (${status})`,
  intraUnreachable: (path) => `The intra did not respond on ${path}`,
  intraUnavailable: (status) => `The intra is not available right now (${status})`,
  intraError: (path, status, reason) => `Intra error on ${path} (${status}${reason ? `: ${reason}` : ''})`,
  notSubscribed: 'You are not signed up for this event',
  noScale: 'The project has no evaluation scale on the intra',
}

const MESSAGES: Record<Lang, Messages> = { es, en }

/** Idioma de la petición: el primero de Accept-Language, o español. */
export function langOf(req: Request): Lang {
  const first = (req.headers['accept-language'] ?? '').split(',')[0]?.trim().toLowerCase() ?? ''
  return first.startsWith('en') ? 'en' : 'es'
}

/** Mensajes en el idioma de la petición. */
export function msg(req: Request): Messages {
  return MESSAGES[langOf(req)]
}

/** Mensajes traducibles que lanza intra.ts: clave del catálogo y sus argumentos. */
export type MessageCode = {
  [K in keyof Messages]: Messages[K] extends string ? { key: K; args?: [] } : { key: K; args: Parameters<Extract<Messages[K], (...a: never[]) => string>> }
}[keyof Messages]

/** Texto de un código en un idioma. */
export function render(m: Messages, code: MessageCode): string {
  const entry = m[code.key] as string | ((...args: unknown[]) => string)
  return typeof entry === 'function' ? entry(...(code.args ?? [])) : entry
}
