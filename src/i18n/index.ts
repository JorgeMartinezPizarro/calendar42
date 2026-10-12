// Idioma de la app. `t` son los textos del idioma activo: lo leen tanto los
// componentes como los módulos sin React (reglas, fechas, exportación).
// I18nProvider (I18nProvider.tsx) decide el idioma y redibuja la app al
// cambiarlo; sin él (pruebas en Node) se queda en español.

import { en } from './en.ts'
import { es, type Messages } from './es.ts'

export type { Messages } from './es.ts'
export type Lang = 'es' | 'en'

const MESSAGES: Record<Lang, Messages> = { es, en }

/** Textos del idioma activo (enlace vivo: cambia con setLanguage). */
export let t: Messages = es
/** Idioma activo. */
export let lang: Lang = 'es'

export function setLanguage(next: Lang): void {
  lang = next
  t = MESSAGES[next]
}

/** País (como lo da la intra) cuyos campus van en español por defecto. */
export const SPANISH_COUNTRY = 'Spain'

/**
 * Idioma de la app. Manda el elegido con las banderas; si no se ha elegido,
 * el que corresponde al campus de la sesión:
 * - campus en España: español;
 * - campus de otro país, o sin campus (null): inglés;
 * - sin sesión o sin el dato (undefined): el del navegador.
 */
export function resolveLanguage(country: string | null | undefined, chosen: Lang | null, browser: Lang): Lang {
  if (chosen) return chosen
  if (country === undefined) return browser
  return country === SPANISH_COUNTRY ? 'es' : 'en'
}

const STORAGE_KEY = 'calendar42:lang'

/** Idioma elegido con la bandera en este navegador, si lo hay. */
export function storedLanguage(): Lang | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value === 'es' || value === 'en' ? value : null
  } catch {
    return null
  }
}

export function storeLanguage(value: Lang): void {
  try {
    localStorage.setItem(STORAGE_KEY, value)
  } catch {
    // Sin localStorage la elección dura lo que la página.
  }
}

/** Idioma del navegador, para la pantalla de login (aún sin campus). */
export function browserLanguage(): Lang {
  const langs = typeof navigator === 'undefined' ? [] : (navigator.languages ?? [navigator.language])
  return langs.some((l) => l?.toLowerCase().startsWith('es')) ? 'es' : 'en'
}
