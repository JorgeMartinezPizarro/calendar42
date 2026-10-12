import { createContext, useContext } from 'react'
import type { Lang } from './index.ts'

/**
 * País del campus de la sesión, para el idioma por defecto:
 * - undefined: aún sin sesión (login) o sesión sin dato de campus.
 * - 'Spain': español.
 * - otro país, o null (sin campus): inglés.
 */
export type CampusCountry = string | null | undefined

export interface I18nContextValue {
  lang: Lang
  /** Elegir idioma con las banderas (se recuerda en este navegador). */
  choose: (lang: Lang) => void
  /** La app indica el país del campus al conocer la sesión. */
  setCampusCountry: (country: CampusCountry) => void
}

export const I18nContext = createContext<I18nContextValue | null>(null)

/** Idioma activo y su selector. Los componentes que lo usan se redibujan al cambiar. */
export function useI18n(): I18nContextValue {
  const value = useContext(I18nContext)
  if (!value) throw new Error('useI18n fuera de I18nProvider')
  return value
}
