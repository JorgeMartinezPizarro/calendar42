import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { I18nContext, type CampusCountry } from './context.ts'
import { browserLanguage, lang as activeLang, resolveLanguage, setLanguage, storeLanguage, storedLanguage, type Lang } from './index.ts'

/**
 * Decide el idioma de la app: el elegido con las banderas (recordado en este
 * navegador) o, si no, el del campus (España: español; resto: inglés). Al
 * cambiar, redibuja todo lo que usa useI18n.
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const [country, setCountry] = useState<CampusCountry>(undefined)
  const [chosen, setChosen] = useState<Lang | null>(storedLanguage)
  const lang = resolveLanguage(country, chosen, browserLanguage())

  // Los textos (`t`) se fijan antes de pintar los hijos de este render.
  if (activeLang !== lang) setLanguage(lang)

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const choose = useCallback((next: Lang) => {
    storeLanguage(next)
    setChosen(next)
  }, [])

  const value = useMemo(() => ({ lang, choose, setCampusCountry: setCountry }), [lang, choose])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}
