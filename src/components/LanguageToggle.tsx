import { useEffect, useRef, useState, type JSX } from 'react'
import { t, type Lang } from '../i18n/index.ts'
import { useI18n } from '../i18n/context.ts'
import './LanguageToggle.css'

/** Bandera de España (sin escudo). */
function SpainFlag() {
  return (
    <svg viewBox="0 0 3 2" width="21" height="14" aria-hidden="true">
      <rect width="3" height="2" fill="#c60b1e" />
      <rect y="0.5" width="3" height="1" fill="#ffc400" />
    </svg>
  )
}

/** Bandera de Inglaterra (cruz de San Jorge). */
function EnglandFlag() {
  return (
    <svg viewBox="0 0 30 20" width="21" height="14" aria-hidden="true">
      <rect width="30" height="20" fill="#fff" />
      <rect x="12.5" width="5" height="20" fill="#ce1124" />
      <rect y="7.5" width="30" height="5" fill="#ce1124" />
    </svg>
  )
}

const OPTIONS: { lang: Lang; Flag: () => JSX.Element }[] = [
  { lang: 'es', Flag: SpainFlag },
  { lang: 'en', Flag: EnglandFlag },
]

/**
 * Selector de idioma: muestra la bandera del idioma activo y, al pulsarla,
 * un menú con los dos idiomas. Se cierra al elegir, al pulsar fuera o con Escape.
 */
function LanguageToggle({ className = '' }: { className?: string }) {
  const { lang, choose } = useI18n()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const Current = OPTIONS.find((o) => o.lang === lang)?.Flag ?? SpainFlag

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className={`langtoggle ${className}`.trim()}>
      <button
        type="button"
        className="langtoggle__current"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={`${t.language.label}: ${t.language[lang]}`}
        aria-label={`${t.language.label}: ${t.language[lang]}`}
      >
        <Current />
      </button>
      {open && (
        <div className="langtoggle__menu" role="menu" aria-label={t.language.label}>
          {OPTIONS.map(({ lang: option, Flag }) => (
            <button
              key={option}
              type="button"
              role="menuitemradio"
              aria-checked={option === lang}
              className={`langtoggle__option${option === lang ? ' langtoggle__option--active' : ''}`}
              onClick={() => {
                choose(option)
                setOpen(false)
              }}
              lang={option}
            >
              <Flag />
              <span>{t.language[option]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default LanguageToggle
