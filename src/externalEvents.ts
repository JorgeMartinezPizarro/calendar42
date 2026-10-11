// Eventos externos: los organiza alguien de fuera (empresas, partners…) y la
// inscripción no se hace en la intra sino en su propia web, cuyo enlace suele
// venir en la descripción. En la intra salen en otro color y su botón de
// inscribirse falla.

import type { EventExtras } from './types.ts'

/**
 * Tipos (`kind`) de la intra que se tratan como externos. Para comprobar el de
 * un evento concreto, su ficha lo muestra en la cabecera ("Evento · Externo").
 */
export const EXTERNAL_KINDS = new Set(['extern', 'partnership'])

// URLs sueltas o dentro de enlaces Markdown: [texto](url).
const URL_RE = /https?:\/\/[^\s<>"'()[\]]+/gi

// Enlaces que tienen pinta de formulario o página de inscripción.
const SIGNUP_RE =
  /(docs\.google\.com\/forms|forms\.gle|forms\.office|eventbrite|meetup\.com|lu\.ma|luma\.com|typeform|tally\.so|ticket|inscri|regist|sign-?up|rsvp)/i

// Enlaces que no llevan fuera: la propia intra o las webs de 42.
const OWN_RE = /(^https?:\/\/([a-z0-9-]+\.)*42\.fr\b|^https?:\/\/([a-z0-9-]+\.)*42madrid\.com\b)/i

/**
 * Enlace de inscripción en un texto. Primero uno con pinta de formulario; si
 * `anyLink`, cualquier enlace que no sea de 42.
 */
export function findSignupUrl(text: string | null | undefined, { anyLink = false } = {}): string | null {
  const urls = (String(text ?? '').match(URL_RE) ?? []).map((u) => u.replace(/[.,;:!?]+$/, ''))
  const signup = urls.find((u) => SIGNUP_RE.test(u) && !OWN_RE.test(u))
  if (signup) return signup
  return anyLink ? (urls.find((u) => !OWN_RE.test(u)) ?? null) : null
}

/**
 * Añade a un evento si es externo (ver EventExtras). El resto de elementos se
 * devuelven tal cual.
 */
export function withEventExtras<T extends { type: string; kind: string; description: string }>(
  item: T,
): T & EventExtras {
  if (item.type !== 'event') return item
  const externalKind = EXTERNAL_KINDS.has(item.kind)
  const signupUrl = findSignupUrl(item.description, { anyLink: externalKind })
  return { ...item, externalKind, signupUrl, external: externalKind || Boolean(signupUrl) }
}
