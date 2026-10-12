import { useState } from 'react'
import { loginDemo, loginWith42, type LoggedIn } from '../api/auth.ts'
import { messageOf } from '../api/http.ts'
import { t } from '../i18n/index.ts'
import LanguageToggle from './LanguageToggle.tsx'
import './LoginView.css'

interface LoginViewProps {
  authConfigured: boolean
  demoAvailable: boolean
  authError: string | null | undefined
  onLoggedIn: (result: LoggedIn) => void
}

function LoginView({ authConfigured, demoAvailable, authError, onLoggedIn }: LoginViewProps) {
  const [busy, setBusy] = useState(false)
  // Motivo que deja el backend en ?auth_error=... si falla el login (se
  // traduce al pintar, así sigue el idioma si se cambia con la bandera).
  const [error, setError] = useState<string | null>(authError ?? null)
  const errorText = error ? (t.login.errors[error] ?? error) : null

  const handleDemo = async () => {
    setBusy(true)
    setError(null)
    try {
      onLoggedIn(await loginDemo())
    } catch (err) {
      setError(messageOf(err))
      setBusy(false)
    }
  }

  return (
    <div className="login">
      <div className="login__card" role="dialog" aria-labelledby="login-title">
        <LanguageToggle className="login__lang" />
        <div className="login__logo" aria-hidden="true">
          42
        </div>
        <h1 id="login-title" className="login__title">
          Calendar42
        </h1>
        <p className="login__subtitle">{t.login.subtitle}</p>

        {errorText && <p className="login__error">{errorText}</p>}

        <button
          type="button"
          className="login__button login__button--primary"
          onClick={loginWith42}
          disabled={!authConfigured || busy}
        >
          {t.login.with42}
        </button>

        {!authConfigured && (
          <p className="login__hint">{t.login.notConfigured}</p>
        )}

        {demoAvailable && (
          <button
            type="button"
            className="login__button login__button--secondary"
            onClick={handleDemo}
            disabled={busy}
            title={t.login.demoTitle}
          >
            {busy ? t.login.demoBusy : t.login.demo}
          </button>
        )}
      </div>
    </div>
  )
}

export default LoginView
