import { useState } from 'react'
import { loginDemo, loginWith42 } from '../api/auth.js'
import './LoginView.css'

const AUTH_ERRORS = {
  state: 'La respuesta de la intra no era válida. Inténtalo de nuevo.',
  exchange: 'No se pudo completar el inicio de sesión con la intra.',
  access_denied: 'Has cancelado la autorización en la intra.',
}

function LoginView({ authConfigured, demoAvailable, authError, onLoggedIn }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(authError ? AUTH_ERRORS[authError] ?? authError : null)

  const handleDemo = async () => {
    setBusy(true)
    setError(null)
    try {
      onLoggedIn(await loginDemo())
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div className="login">
      <div className="login__card" role="dialog" aria-labelledby="login-title">
        <div className="login__logo" aria-hidden="true">
          42
        </div>
        <h1 id="login-title" className="login__title">
          Calendar42
        </h1>
        <p className="login__subtitle">Calendario de eventos para estudiantes de 42 Madrid</p>

        {error && <p className="login__error">{error}</p>}

        <button
          type="button"
          className="login__button login__button--primary"
          onClick={loginWith42}
          disabled={!authConfigured || busy}
        >
          Iniciar sesión con 42
        </button>

        {!authConfigured && (
          <p className="login__hint">
            El servidor no tiene configurada la app OAuth de 42. Añade{' '}
            <code>FT_CLIENT_ID</code> y <code>FT_CLIENT_SECRET</code> en <code>.env</code> para
            iniciar sesión con la intra.
          </p>
        )}

        {demoAvailable && (
          <button
            type="button"
            className="login__button login__button--secondary"
            onClick={handleDemo}
            disabled={busy}
            title="Datos de ejemplo, sin tocar la intra"
          >
            {busy ? 'Entrando…' : 'Entrar en modo demo'}
          </button>
        )}
      </div>
    </div>
  )
}

export default LoginView
