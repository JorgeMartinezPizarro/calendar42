import { useCallback, useEffect, useMemo, useState } from 'react'
import Calendar from './components/Calendar.jsx'
import DayView from './components/DayView.jsx'
import ItemList from './components/ItemList.jsx'
import ItemPopover from './components/ItemPopover.jsx'
import LoginView from './components/LoginView.jsx'
import ModeBar from './components/ModeBar.jsx'
import ProjectPicker from './components/ProjectPicker.jsx'
import SlotCreator from './components/SlotCreator.jsx'
import { AGENDA_TYPES, isMine } from './agendaTypes.js'
import { fetchMe, logout } from './api/auth.js'
import { fetchAgenda } from './api/agenda.js'
import { fetchUpcomingEvents, setEventSubscription } from './api/events.js'
import { fetchProjects } from './api/projects.js'
import { bookCorrection, createSlot, deleteSlots, fetchProjectSlots } from './api/slots.js'
import { useNow } from './hooks/useNow.js'
import {
  bookingState,
  overlappingItems,
  slotDeleteState,
  subscriptionState,
} from './subscription.js'
import { addMonths, getMonthGridRange, toDateKey } from './utils/date.js'
import './App.css'

const EMPTY = []
const NO_PROJECTS = { status: 'idle', items: EMPTY, error: null }
const NO_UPCOMING = { status: 'idle', items: EMPTY, error: null }
const LOADING = { status: 'loading', items: EMPTY, error: null }
const IDLE_ACTION = { busy: false, error: null, created: null }

function monthKey(date) {
  return `${date.getFullYear()}-${date.getMonth()}`
}

/** Rango [start, end) de la rejilla del mes de una clave 'YYYY-M'. */
function rangeOfKey(key) {
  const [year, month] = key.split('-').map(Number)
  return getMonthGridRange(year, month)
}

const byBegin = (a, b) => a.beginAt - b.beginAt

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
    setProjects(NO_PROJECTS)
    setUpcoming(NO_UPCOMING)
    setFreeSlotsByKey({})
    await backToLogin()
  }

  // ---- calendario ---------------------------------------------------------
  const today = new Date()
  const [selectedDate, setSelectedDate] = useState(today)
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const now = useNow()

  // Agenda cacheada por mes visible: { 'YYYY-M': { items, counts, warnings } }
  const [agendaByMonth, setAgendaByMonth] = useState({})
  const [status, setStatus] = useState('idle') // idle | loading | error
  const [error, setError] = useState(null)

  const currentKey = monthKey(viewDate)
  const loggedIn = auth.status === 'ready' && Boolean(auth.user)

  // Meses que siempre tienen que estar cargados: el visible y, para las listas
  // de próximos eventos y exámenes (de hoy a dentro de un mes), el de hoy y el
  // siguiente.
  const todayKey = monthKey(today)
  const nextKey = monthKey(addMonths(today, 1))
  const missingKeys = [...new Set([currentKey, todayKey, nextKey])].filter((k) => !agendaByMonth[k])
  const missingList = missingKeys.join(',')

  useEffect(() => {
    if (!loggedIn || !missingList) return

    const controller = new AbortController()
    const keys = missingList.split(',')

    setStatus('loading')
    setError(null)

    Promise.all(
      keys.map((key) => {
        const { start, end } = rangeOfKey(key)
        return fetchAgenda(start, end, { signal: controller.signal }).then((data) => [key, data])
      }),
    )
      .then((entries) => {
        setAgendaByMonth((prev) => ({
          ...prev,
          ...Object.fromEntries(
            entries.map(([key, { items, counts, warnings }]) => [key, { items, counts, warnings }]),
          ),
        }))
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
  }, [loggedIn, missingList])

  const currentMonth = agendaByMonth[currentKey]

  // Todo lo cargado, sin repetidos: las rejillas de dos meses seguidos
  // comparten días, así que un mismo elemento puede venir en ambos.
  const allItems = useMemo(() => {
    const byId = new Map()
    for (const month of Object.values(agendaByMonth)) {
      for (const it of month.items) byId.set(it.id, it)
    }
    return [...byId.values()]
  }, [agendaByMonth])

  // Lo del usuario: va siempre al calendario y a la vista del día.
  const visibleItems = useMemo(() => allItems.filter(isMine), [allItems])

  // Modo "Eventos": todos los eventos futuros del campus (la intra publica
  // pocos, así que caben todos), inscrito o no, con su propia carga.
  const [upcoming, setUpcoming] = useState(NO_UPCOMING)

  useEffect(() => {
    if (!loggedIn) return
    const controller = new AbortController()
    setUpcoming((prev) => ({ ...prev, status: 'loading', error: null }))
    fetchUpcomingEvents({ signal: controller.signal })
      .then((items) => setUpcoming({ status: 'idle', items, error: null }))
      .catch((err) => {
        if (err.name === 'AbortError') return
        if (err.status === 401) {
          backToLogin()
          return
        }
        setUpcoming({ status: 'error', items: EMPTY, error: err.message })
      })
    return () => controller.abort()
  }, [loggedIn])

  const upcomingEvents = useMemo(
    () => upcoming.items.filter((it) => it.endAt > now).sort(byBegin),
    [upcoming.items, now],
  )

  // Modo "Exámenes": los disponibles que empiezan de hoy a dentro de un mes.
  const availableExams = useMemo(() => {
    const limit = addMonths(now, 1)
    limit.setDate(now.getDate())
    return allItems
      .filter((it) => it.type === 'exam' && !it.subscribed && it.endAt > now && it.beginAt < limit)
      .sort(byBegin)
  }, [allItems, now])

  // Olvida los meses cargados cuya rejilla incluye esa fecha (tras crear o
  // borrar algo ahí), para que el efecto de carga vuelva a pedirlos.
  const forgetMonthsCovering = (date) =>
    setAgendaByMonth((prev) =>
      Object.fromEntries(
        Object.entries(prev).filter(([key]) => {
          const { start, end } = rangeOfKey(key)
          return !(date >= start && date < end)
        }),
      ),
    )

  // Olvida el mes visible para que el efecto de carga vuelva a pedirlo.
  const retryMonth = () =>
    setAgendaByMonth((prev) => {
      const next = { ...prev }
      delete next[currentKey]
      return next
    })

  // ---- modos --------------------------------------------------------------
  // Correcciones, Exámenes, Eventos y Crear slots. Junto a cada botón, lo que
  // la API no permite (motivo) o el último error de la intra en ese modo.
  const [mode, setMode] = useState('corrections')
  const [modeNotes, setModeNotes] = useState({
    exams: { kind: 'reason', text: 'La API no deja inscribirse a exámenes: solo desde la intra' },
  })
  const noteMode = useCallback((key, kind, text) => {
    setModeNotes((prev) => ({ ...prev, [key]: text ? { kind, text } : undefined }))
  }, [])

  // ---- proyectos y slots libres (modo Correcciones) ------------------------
  const [projects, setProjects] = useState(NO_PROJECTS)
  const [selectedProjectId, setSelectedProjectId] = useState(null)
  const selectedProject = projects.items.find((p) => p.id === selectedProjectId) ?? null

  useEffect(() => {
    if (!loggedIn) return
    const controller = new AbortController()
    setProjects((prev) => ({ ...prev, status: 'loading', error: null }))
    fetchProjects({ signal: controller.signal })
      .then((items) => setProjects({ status: 'idle', items, error: null }))
      .catch((err) => {
        if (err.name === 'AbortError') return
        if (err.status === 401) {
          backToLogin()
          return
        }
        setProjects({ status: 'error', items: EMPTY, error: err.message })
      })
    return () => controller.abort()
  }, [loggedIn])

  // Slots libres de otros estudiantes para el proyecto cerrado elegido, por
  // proyecto y mes visible: { 'projectId:YYYY-M': { status, items, error } }.
  const [freeSlotsByKey, setFreeSlotsByKey] = useState({})
  const freeProjectId = mode === 'corrections' && selectedProject?.closed ? selectedProject.projectId : null
  const freeKey = freeProjectId ? `${freeProjectId}:${currentKey}` : null

  useEffect(() => {
    if (!loggedIn || !freeKey || freeSlotsByKey[freeKey]) return
    const controller = new AbortController()
    const { start, end } = getMonthGridRange(viewDate.getFullYear(), viewDate.getMonth())
    fetchProjectSlots(freeProjectId, start, end, { signal: controller.signal })
      .then((items) =>
        setFreeSlotsByKey((prev) => ({ ...prev, [freeKey]: { status: 'idle', items, error: null } })),
      )
      .catch((err) => {
        if (err.name === 'AbortError') return
        if (err.status === 401) {
          backToLogin()
          return
        }
        setFreeSlotsByKey((prev) => ({
          ...prev,
          [freeKey]: { status: 'error', items: EMPTY, error: err.message },
        }))
        if (err.status === 403) noteMode('corrections', 'reason', err.message)
      })
    return () => controller.abort()
  }, [loggedIn, freeKey, freeProjectId, freeSlotsByKey, viewDate, noteMode])

  const freeSlots = freeKey ? (freeSlotsByKey[freeKey] ?? LOADING) : null
  const freeItems = freeSlots?.items ?? EMPTY

  // Lo que se pinta en el día y marca el calendario: lo del usuario y, en
  // Correcciones, las franjas libres del proyecto elegido.
  const dayItems = useMemo(
    () => (freeItems.length ? [...visibleItems, ...freeItems] : visibleItems),
    [visibleItems, freeItems],
  )

  // Día (clave local) -> Set de tipos presentes, para las marcas del calendario.
  const dayTypes = useMemo(() => {
    const map = new Map()
    for (const it of dayItems) {
      // Un elemento que dura varios días marca cada uno de ellos.
      const cursor = new Date(it.beginAt.getFullYear(), it.beginAt.getMonth(), it.beginAt.getDate())
      while (cursor < it.endAt) {
        const key = toDateKey(cursor)
        if (!map.has(key)) map.set(key, new Set())
        map.get(key).add(it.type)
        cursor.setDate(cursor.getDate() + 1)
      }
    }
    return map
  }, [dayItems])

  // ---- ficha --------------------------------------------------------------
  // Se abre al pulsar un elemento (lista o vista del día) y ocupa el sitio de
  // la vista del día (toda la pantalla en móvil) hasta cerrarla.
  const [openId, setOpenId] = useState(null)
  const openItemCard = useCallback((item) => setOpenId(item.id), [])
  const closeItem = useCallback(() => setOpenId(null), [])

  // Elegir un día en el calendario cierra la ficha para enseñar ese día.
  const selectDate = useCallback((date) => {
    setSelectedDate(date)
    setOpenId(null)
  }, [])

  const changeMode = useCallback((next) => {
    setMode(next)
    setOpenId(null)
  }, [])

  // Todo lo que puede tener ficha abierta, sin repetidos: si un evento está en
  // la lista de futuros y en la agenda, manda la versión de la agenda.
  const cardItems = useMemo(() => {
    const byId = new Map()
    for (const it of upcoming.items) byId.set(it.id, it)
    for (const it of allItems) byId.set(it.id, it)
    for (const it of freeItems) byId.set(it.id, it)
    return [...byId.values()]
  }, [allItems, freeItems, upcoming.items])
  const openItem = openId ? (cardItems.find((it) => it.id === openId) ?? null) : null

  // Apuntarse a eventos exige el scope "profile" en el token (ver intra.js).
  // Si la sesión no lo tiene, el botón sale desactivado con el motivo en vez
  // de fallar al pulsarlo. Sin dato de scope (sesiones antiguas) se intenta.
  const scopeOk = Boolean(auth.demo) || !auth.scope || auth.scope.split(' ').includes('profile')

  // "Slot libre / ocupado": lo del usuario que se solapa con el elemento de la ficha.
  const conflicts = useMemo(
    () =>
      openItem && ['event', 'exam', 'free'].includes(openItem.type)
        ? overlappingItems(openItem, allItems)
        : null,
    [openItem, allItems],
  )

  // ---- acciones sobre la intra --------------------------------------------
  const [actions, setActions] = useState({}) // id del elemento -> { busy, error }
  const startAction = (id) => setActions((prev) => ({ ...prev, [id]: { busy: true, error: null } }))
  const endAction = (id, error = null) =>
    setActions((prev) => {
      const next = { ...prev }
      if (error) next[id] = { busy: false, error }
      else delete next[id]
      return next
    })

  // Aplica un cambio a un elemento allá donde esté: en la agenda por meses y
  // en la lista de eventos futuros.
  const patchItem = (id, patch) => {
    const apply = (items) => items.map((it) => (it.id === id ? { ...it, ...patch } : it))
    setAgendaByMonth((prev) =>
      Object.fromEntries(
        Object.entries(prev).map(([key, month]) => [key, { ...month, items: apply(month.items) }]),
      ),
    )
    setUpcoming((prev) => ({ ...prev, items: apply(prev.items) }))
  }

  // Apuntarse o borrarse de un evento. La ficha se queda abierta, actualizada.
  const toggleSubscription = async (item) => {
    const subscribe = !item.subscribed
    startAction(item.id)
    try {
      const result = await setEventSubscription(item.eventId, subscribe)
      patchItem(item.id, {
        subscribed: result.subscribed,
        subscribers:
          result.subscribers ?? Math.max(0, (item.subscribers ?? 0) + (result.subscribed ? 1 : -1)),
      })
      endAction(item.id)
      noteMode('events', 'error', null)
    } catch (err) {
      if (err.status === 401) return backToLogin()
      endAction(item.id, err.message)
      if (err.status === 403) noteMode('events', 'reason', err.message)
    }
  }

  // Reservar una corrección del proyecto elegido en una franja libre.
  const book = async (item, startAt) => {
    if (!selectedProject) return
    startAction(item.id)
    try {
      await bookCorrection({
        projectId: selectedProject.projectId,
        teamId: selectedProject.teamId,
        beginAt: startAt,
        correctorId: item.corrector?.id ?? null,
      })
      endAction(item.id)
      noteMode('corrections', 'error', null)
      closeItem()
      // La agenda y los slots libres del mes cambian: se vuelven a pedir.
      setFreeSlotsByKey((prev) => {
        const next = { ...prev }
        delete next[freeKey]
        return next
      })
      forgetMonthsCovering(startAt)
    } catch (err) {
      if (err.status === 401) return backToLogin()
      endAction(item.id, err.message)
      noteMode('corrections', err.status === 403 ? 'reason' : 'error', err.message)
    }
  }

  // Borrar un slot propio (todos sus bloques de 15 min).
  const removeSlot = async (item) => {
    startAction(item.id)
    try {
      await deleteSlots(item.slotIds)
      endAction(item.id)
      noteMode('slots', 'error', null)
      closeItem()
      forgetMonthsCovering(item.beginAt)
    } catch (err) {
      if (err.status === 401) return backToLogin()
      endAction(item.id, err.message)
      noteMode('slots', err.status === 403 ? 'reason' : 'error', err.message)
    }
  }

  // ---- crear slots --------------------------------------------------------
  const [pendingRange, setPendingRange] = useState(null) // { beginAt, endAt } marcada en las horas
  const [slotAction, setSlotAction] = useState(IDLE_ACTION)

  const selectRange = useCallback((range) => {
    setPendingRange(range)
    setSlotAction(IDLE_ACTION)
    setOpenId(null)
  }, [])

  // Cambiar de modo o de día descarta la franja marcada.
  useEffect(() => {
    setPendingRange(null)
  }, [mode, selectedDate])

  const createPendingSlot = async () => {
    if (!pendingRange) return
    setSlotAction({ busy: true, error: null, created: null })
    try {
      const items = await createSlot(pendingRange)
      setSlotAction({ busy: false, error: null, created: items[0] ?? pendingRange })
      setPendingRange(null)
      noteMode('slots', 'error', null)
      forgetMonthsCovering(pendingRange.beginAt)
    } catch (err) {
      if (err.status === 401) return backToLogin()
      setSlotAction({ busy: false, error: err.message, created: null })
      noteMode('slots', err.status === 403 ? 'reason' : 'error', err.message)
    }
  }

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

  const panel = openItem && (
    <ItemPopover
      item={openItem}
      subscription={subscriptionState(openItem, now, { scopeOk })}
      booking={
        openItem.type === 'free'
          ? { project: selectedProject, state: bookingState(openItem, selectedProject, now) }
          : null
      }
      slotDelete={slotDeleteState(openItem, now)}
      conflicts={conflicts}
      action={actions[openItem.id]}
      onToggleSubscription={toggleSubscription}
      onBook={book}
      onDeleteSlot={removeSlot}
      onClose={closeItem}
    />
  )

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
            onSelectDate={selectDate}
            dayTypes={dayTypes}
          />
          <ModeBar mode={mode} onChange={changeMode} notes={modeNotes} />

          {mode === 'corrections' && (
            <ProjectPicker
              projects={projects.items}
              status={projects.status}
              error={projects.error}
              selectedId={selectedProjectId}
              onSelect={setSelectedProjectId}
              freeSlots={freeSlots}
            />
          )}
          {mode === 'exams' && (
            <ItemList
              title="Próximos exámenes"
              items={availableExams}
              status={status}
              emptyText="Ningún examen disponible en el próximo mes"
              openItemId={openItem?.id ?? null}
              onOpenItem={openItemCard}
            />
          )}
          {mode === 'events' && (
            <ItemList
              title="Próximos eventos"
              items={upcomingEvents}
              status={upcoming.status}
              emptyText={upcoming.error ?? 'Ningún evento futuro en la intra'}
              openItemId={openItem?.id ?? null}
              onOpenItem={openItemCard}
            />
          )}
          {mode === 'slots' && (
            <SlotCreator
              pending={pendingRange}
              action={slotAction}
              now={now}
              onCreate={createPendingSlot}
              onCancel={() => setPendingRange(null)}
            />
          )}
        </aside>
        <section className="app__content">
          <DayView
            date={selectedDate}
            items={dayItems}
            status={status}
            panel={panel}
            openItemId={openItem?.id ?? null}
            onOpenItem={openItemCard}
            selectable={mode === 'slots'}
            draft={mode === 'slots' ? pendingRange : null}
            onRangeSelect={selectRange}
          />
        </section>
      </main>
    </div>
  )
}

export default App
