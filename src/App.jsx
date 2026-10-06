import { useEffect, useMemo, useState } from 'react'
import Calendar from './components/Calendar.jsx'
import DayView from './components/DayView.jsx'
import LoginView from './components/LoginView.jsx'
import TypeFilter from './components/TypeFilter.jsx'
import { AGENDA_TYPES, DEFAULT_FILTERS, isItemVisible } from './agendaTypes.js'
import { fetchMe, logout } from './api/auth.js'
import { fetchAgenda } from './api/agenda.js'
import { getMonthGridRange, toDateKey } from './utils/date.js'
import './App.css'

function monthKey(date) {
  return `${date.getFullYear()}-${date.getMonth()}`
}

/** Lee y limpia ?auth_error=... que deja el backend si falla el login. */
function takeAuthErrorFromUrl() {
  const params = new URLSearchParams(window.location.search)
  const value = params.get('auth_error')
  if (value) {
    params.delete('auth_error')
    const query = params.toString()
    window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}`)
  }
  return value
}

const SOURCE_LABELS = {
  ...Object.fromEntries(AGENDA_TYPES.map((t) => [t.type, t.label])),
  myEvents: 'Mis eventos',
  myExams: 'Mis exámenes',
}

function describeWarning(w) {
  return `${SOURCE_LABELS[w.type] ?? w.type}: ${w.message}`
}

function App() {
  // ---- sesión -------------------------------------------------------------
  const [auth, setAuth] = useState({ status: 'checking', user: null })
  const [authError] = useState(takeAuthErrorFromUrl)

  useEffect(() => {
    fetchMe()
      .then((result) => setAuth({ status: 'ready', ...result }))
      .catch((err) => setAuth({ status: 'ready', user: null, error: err.message }))
  }, [])

  const backToLogin = () =>
    fetchMe()
      .catch(() => ({ user: null }))
      .then((result) => setAuth({ status: 'ready', ...result }))

  const handleLogout = async () => {
    await logout()
    setAgendaByMonth({})
    await backToLogin()
  }

  // ---- calendario ---------------------------------------------------------
  const today = new Date()
  const [selectedDate, setSelectedDate] = useState(today)
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [enabledFilters, setEnabledFilters] = useState(DEFAULT_FILTERS)

  // Agenda cacheada por mes visible: { 'YYYY-M': { items, counts, warnings } }
  const [agendaByMonth, setAgendaByMonth] = useState({})
  const [status, setStatus] = useState('idle') // idle | loading | error
  const [error, setError] = useState(null)

  const currentKey = monthKey(viewDate)
  const loggedIn = auth.status === 'ready' && Boolean(auth.user)

  useEffect(() => {
    if (!loggedIn || agendaByMonth[currentKey]) return

    const controller = new AbortController()
    const { start, end } = getMonthGridRange(viewDate.getFullYear(), viewDate.getMonth())

    setStatus('loading')
    setError(null)

    fetchAgenda(start, end, { signal: controller.signal })
      .then(({ items, counts, warnings }) => {
        setAgendaByMonth((prev) => ({ ...prev, [currentKey]: { items, counts, warnings } }))
        setStatus('idle')
      })
      .catch((err) => {
        if (err.name === 'AbortError') return
        if (err.status === 401) {
          backToLogin() // la sesión caducó en el servidor
          return
        }
        setError(err.message)
        setStatus('error')
      })

    return () => controller.abort()
  }, [loggedIn, currentKey, viewDate, agendaByMonth])

  const currentMonth = agendaByMonth[currentKey]

  // Todo lo cargado (el día seleccionado puede caer en celdas de otro mes),
  // filtrado por las categorías activas.
  const visibleItems = useMemo(
    () =>
      Object.values(agendaByMonth)
        .flatMap((m) => m.items)
        .filter((it) => isItemVisible(it, enabledFilters)),
    [agendaByMonth, enabledFilters],
  )

  // Día (clave local) -> Map tipo -> { mine }, para las marcas del calendario.
  // Slots y correcciones son siempre personales, así que cuentan como "míos".
  const dayTypes = useMemo(() => {
    const map = new Map()
    for (const it of visibleItems) {
      const mine = it.type === 'slot' || it.type === 'correction' || Boolean(it.subscribed)
      // Un elemento que dura varios días marca cada uno de ellos.
      const cursor = new Date(it.beginAt.getFullYear(), it.beginAt.getMonth(), it.beginAt.getDate())
      while (cursor < it.endAt) {
        const key = toDateKey(cursor)
        if (!map.has(key)) map.set(key, new Map())
        const byType = map.get(key)
        const prev = byType.get(it.type)
        byType.set(it.type, { mine: Boolean(prev?.mine) || mine })
        cursor.setDate(cursor.getDate() + 1)
      }
    }
    return map
  }, [visibleItems])

  const toggleFilter = (key) => setEnabledFilters((prev) => ({ ...prev, [key]: !prev[key] }))

  // Olvida el mes visible para que el efecto de carga vuelva a pedirlo.
  const retryMonth = () =>
    setAgendaByMonth((prev) => {
      const next = { ...prev }
      delete next[currentKey]
      return next
    })

  // ---- render -------------------------------------------------------------
  if (auth.status === 'checking') {
    return <div className="app__splash">Cargando…</div>
  }

  if (!loggedIn) {
    return (
      <LoginView
        authConfigured={Boolean(auth.authConfigured)}
        demoAvailable={Boolean(auth.demoAvailable)}
        authError={authError ?? auth.error}
        onLoggedIn={(result) => setAuth({ status: 'ready', ...result })}
      />
    )
  }

  const warnings = currentMonth?.warnings ?? []
  const coalition = auth.user.coalition ?? null
  const coalitionStyle = coalition?.color ? { '--coalition': coalition.color } : undefined

  return (
    <div className={`app${coalition ? ' app--coalition' : ''}`} style={coalitionStyle}>
      <header className="app__header">
        <h1>Calendar42</h1>
        <p className="app__subtitle">Calendario para estudiantes de 42 Madrid</p>
        {auth.demo && (
          <span className="app__notice" title="Configura FT_CLIENT_ID y FT_CLIENT_SECRET en .env">
            Modo demo
          </span>
        )}
        {status === 'error' && (
          <span className="app__error">
            No se pudo cargar la agenda: {error}
            <button type="button" className="app__retry" onClick={retryMonth}>
              Reintentar
            </button>
          </span>
        )}
        {status !== 'error' && warnings.length > 0 && (
          <span className="app__warning" title={warnings.map(describeWarning).join('\n')}>
            {warnings.some((w) => w.code === 'transient_error')
              ? `La intra no respondió para ${warnings.length} fuente${warnings.length === 1 ? '' : 's'}`
              : `${warnings.length} fuente${warnings.length === 1 ? '' : 's'} con aviso`}
            <button type="button" className="app__retry" onClick={retryMonth}>
              Reintentar
            </button>
          </span>
        )}
        <div className="app__user">
          {coalition && (
            <span className="coalition" title={`Coalición: ${coalition.name}`}>
              <span className="coalition__emblem" aria-hidden="true">
                {coalition.image ? (
                  <img className="coalition__logo" src={coalition.image} alt="" />
                ) : (
                  coalition.name.replace(/^the\s+/i, '').charAt(0).toUpperCase()
                )}
              </span>
              <span className="coalition__text">
                <span className="coalition__label">Coalición</span>
                <span className="coalition__name">{coalition.name}</span>
              </span>
            </span>
          )}
          {auth.user.image && (
            <img className="app__avatar" src={auth.user.image} alt="" width="28" height="28" />
          )}
          <span className="app__login">{auth.user.login}</span>
          <button type="button" className="app__logout" onClick={handleLogout}>
            Salir
          </button>
        </div>
      </header>

      <main className="app__layout">
        <aside className="app__sidebar">
          <Calendar
            viewDate={viewDate}
            onViewDateChange={setViewDate}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            dayTypes={dayTypes}
          />
          <TypeFilter enabled={enabledFilters} counts={currentMonth?.counts} onToggle={toggleFilter} />
        </aside>
        <section className="app__content">
          <DayView date={selectedDate} items={visibleItems} status={status} />
        </section>
      </main>
    </div>
  )
}

export default App
