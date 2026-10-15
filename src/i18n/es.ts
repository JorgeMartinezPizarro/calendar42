// Textos en español: la referencia. en.ts tiene la misma forma (Messages), así
// que si falta un texto en inglés TypeScript no compila. Los textos con datos
// son funciones.

import type { ItemType } from '../types.ts'

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)

export const es = {
  /** Locale para fechas y horas. */
  locale: 'es-ES',
  /** Iniciales de los días, de lunes a domingo. */
  weekdays: ['L', 'M', 'X', 'J', 'V', 'S', 'D'],

  common: {
    retry: 'Reintentar',
    loading: 'Cargando…',
    oneMoment: 'Un momento…',
    close: 'Cerrar',
    cancel: 'Cancelar',
  },

  language: {
    /** Grupo de las banderas. Los nombres de idioma van siempre en su idioma. */
    label: 'Idioma',
    es: 'Español',
    en: 'English',
  },

  app: {
    tagline: (campus: string | null) =>
      campus ? `Calendario para estudiantes de 42 ${campus}` : 'Calendario para estudiantes de 42',
    demoBadge: 'Demo',
    demoBadgeTitle: 'Datos de ejemplo, sin tocar la intra',
    agendaError: (message: string) => `No se pudo cargar la agenda: ${message}`,
    intraNoResponse: (n: number) => `La intra no respondió para ${n} ${plural(n, 'fuente', 'fuentes')}`,
    sourcesWithWarning: (n: number) => `${n} ${plural(n, 'fuente', 'fuentes')} con aviso`,
    coalition: 'Coalición',
    coalitionTitle: (name: string) => `Coalición: ${name}`,
    logout: 'Salir',
    upcomingExams: 'Próximos exámenes',
    noExams: 'Ningún examen disponible en el próximo mes',
    upcomingEvents: 'Próximos eventos',
    noEvents: 'Ningún evento futuro en la intra',
    splash: 'Cargando…',
  },

  /** Avisos de fuentes de la agenda que no se pudieron cargar. */
  warnings: {
    sources: {
      event: 'Eventos',
      exam: 'Exámenes',
      slot: 'Slots abiertos',
      correction: 'Correcciones',
      free: 'Slots libres',
      myEvents: 'Mis eventos',
      myExams: 'Mis exámenes',
    } as Record<string, string>,
    missingScope: 'La sesión no tiene el scope "projects". Cierra sesión y vuelve a entrar.',
  },

  export: {
    title: 'Descarga tu agenda en .ics para importarla en Google Calendar, Outlook o Apple Calendar',
    ariaLabel: 'Exportar la agenda en formato iCalendar (.ics)',
    nothing: 'Nada que exportar: no tienes nada en la agenda desde hoy.',
    done: (n: number) =>
      `Descargado con ${n} ${plural(n, 'elemento', 'elementos')}. En Google Calendar: Configuración → Importar y exportar → Importar. Si lo vuelves a importar, se actualiza sin duplicar.`,
    failed: (message: string) => `No se pudo exportar: ${message}`,
    signup: 'Inscripción',
  },

  source: 'Código fuente en GitHub',

  calendar: {
    label: 'Calendario mensual',
    prevMonth: 'Mes anterior',
    nextMonth: 'Mes siguiente',
    today: 'Hoy',
    refresh: 'Actualizar la agenda desde la intra',
  },

  /** Tipos en plural: marcas del calendario y leyendas. */
  types: {
    event: 'Eventos',
    exam: 'Exámenes',
    slot: 'Slots abiertos',
    correction: 'Correcciones',
    free: 'Slots libres',
  } satisfies Record<ItemType, string>,

  /** Tipo de un elemento, en singular: ficha y exportación. */
  itemType: {
    event: 'Evento',
    exam: 'Examen',
    slot: 'Slot de corrección',
    correction: 'Corrección',
    free: 'Slot libre para corrección',
  } satisfies Record<ItemType, string>,

  /** Subtipos de evento de la intra. */
  kinds: {
    conference: 'Conferencia',
    meetup: 'Meetup',
    workshop: 'Taller',
    atelier: 'Taller',
    rush: 'Rush',
    hackathon: 'Hackathon',
    extern: 'Externo',
    association: 'Asociación',
    partnership: 'Partner',
    challenge: 'Reto',
    piscine: 'Piscina',
    pedago: 'Pedagogía',
  } as Record<string, string>,

  modes: {
    nav: 'Modo',
    events: 'Eventos',
    corrections: 'Correcciones',
    exams: 'Exámenes',
    slots: 'Crear slots',
  },

  login: {
    subtitle: 'Calendario para estudiantes de 42: eventos, exámenes, slots y correcciones en una sola agenda',
    with42: 'Iniciar sesión con 42',
    notConfigured: 'El servidor no tiene configurada la app OAuth de 42. Añade FT_CLIENT_ID y FT_CLIENT_SECRET en .env para iniciar sesión con la intra.',
    demo: 'Entrar en modo demo',
    demoBusy: 'Entrando…',
    demoTitle: 'Datos de ejemplo, sin tocar la intra',
    errors: {
      state: 'La respuesta de la intra no era válida. Inténtalo de nuevo.',
      exchange: 'No se pudo completar el inicio de sesión con la intra.',
      access_denied: 'Has cancelado la autorización en la intra.',
    } as Record<string, string>,
  },

  /**
   * Nombre y descripción de lo que no escribe la intra: slots, franjas libres,
   * correcciones y los datos de un examen (ver itemText.ts).
   */
  items: {
    openSlot: 'Slot de corrección abierto',
    slotDescription: (blocks: number) => `Disponible para corregir (${blocks} × 15 min)`,
    freeSlot: 'Slot libre para corrección',
    freeSlotOf: (login: string) => `Slot libre · ${login}`,
    freeDescription: (blocks: number) => `Un estudiante puede corregirte en esta franja (${blocks} × 15 min).`,
    correction: (project: string) => `Corrección: ${project}`,
    youEvaluate: 'Tú corriges',
    youAreEvaluated: 'Te corrigen',
    corrector: 'Corrector',
    correcteds: 'Corregidos',
    team: 'Equipo',
    evaluationDone: (mark: number | null) => `Evaluación entregada${mark != null ? ` · nota ${mark}` : ''}`,
    bookedHere: 'Reservada desde Calendar42 (demo)',
    evaluationLasts: (minutes: number) => `La corrección de este proyecto dura ${minutes} min.`,
    examProjects: 'Proyectos',
    examCursus: 'Cursus',
    examIp: 'IP',
  },

  list: {
    subscribed: 'inscrito',
    external: 'externo',
  },

  popover: {
    externalSignup: 'Inscripción externa',
    subscribed: 'Inscrito',
    when: 'Cuándo',
    where: 'Dónde',
    capacity: 'Aforo',
    corrector: 'Corrector',
    people: (n: number) => `${n} ${plural(n, 'inscrito', 'inscritos')}`,
    seats: (n: number) => `${n} plazas`,
    subscribe: 'Apuntarme',
    unsubscribe: 'Borrarme',
    signupOnWeb: 'Inscribirse en su web ↗',
    startAt: 'Empezar a las',
    clashes: ' · choca',
    book: 'Agendar corrección',
    bookProject: (project: string) => `Agendar corrección de ${project}`,
    deleteSlot: 'Borrar slot',
    slotBusy: 'Slot ocupado',
    slotFree: 'Slot libre',
    slotBusyTitle: 'Se solapa con algo de tu agenda',
    slotFreeTitle: 'No se solapa con nada de tu agenda',
    overlapsWith: 'Solapa con',
  },

  day: {
    label: 'Vista del día por horas',
    panelLabel: 'Detalle del elemento',
    backToMonth: 'Volver al mes',
    today: 'Hoy',
    nothing: 'Nada previsto',
    count: (n: number) => `${n} ${plural(n, 'elemento', 'elementos')}`,
    prevDay: 'Día anterior',
    nextDay: 'Día siguiente',
    selectHint: 'Arrastra con el ratón o toca una hora para crear un slot; ajústalo con los tiradores',
    subscribedBadge: 'Inscrito',
    newSlot: 'Nuevo slot',
    slotStart: 'Inicio del slot',
    slotEnd: 'Fin del slot',
    now: (time: string) => `Hora actual ${time}`,
    metaFree: 'pulsa para agendar',
    metaCorrector: 'corriges',
    metaCorrected: 'te corrigen',
    metaDone: 'hecha',
  },

  slots: {
    label: 'Crear slot de corrección',
    title: 'Crear slot',
    hint: (min: number, gap: number) =>
      `Elige un día y marca cuándo puedes corregir: arrastrando sobre las horas con el ratón o tocando una hora con el dedo. Luego ajusta la franja con los tiradores o con los botones de 15 minutos. Los slots van en bloques de 15 minutos, duran al menos ${min} y entre dos slots deben quedar ${gap} minutos libres.`,
    pending: (range: string) => `Nuevo slot · ${range}`,
    start: 'Inicio',
    end: 'Fin',
    earlier: (label: string) => `${label} 15 minutos antes`,
    later: (label: string) => `${label} 15 minutos después`,
    create: 'Crear slot',
    creating: 'Creando…',
    created: (range: string) => `Slot creado: ${range}. Puedes borrarlo desde su ficha.`,
  },

  projects: {
    label: 'Proyectos del alumno',
    title: 'Correcciones',
    status: {
      waiting_for_correction: 'Cerrado, pendiente de corrección',
      in_progress: 'En curso',
      searching_a_group: 'Buscando grupo',
      creating_group: 'Creando grupo',
    } as Record<string, string>,
    groupClosed: 'Cerrados, listos para corrección',
    groupOpen: 'En curso, aún sin cerrar',
    notClosedYet: 'Hasta que cierres el proyecto no se puede agendar su corrección.',
    searchingSlots: 'Buscando slots libres…',
    refresh: 'Volver a buscar slots libres',
    slotsDisabled:
      'Búsqueda de slots desactivada: la API de 42 no da los slots libres reales de un proyecto (devuelve una muestra al azar). Agenda la corrección desde la intra.',
    noFreeSlots: 'Ningún slot libre este mes para corregir este proyecto.',
    noFreeSlotsFor: (minutes: number) =>
      `Ningún hueco libre este mes donde quepa la corrección de este proyecto (${minutes} min).`,
    freeSlots: (n: number, minutes: number | null) =>
      `${n} ${plural(n, 'franja libre', 'franjas libres')} este mes${minutes ? ` donde cabe la corrección (${minutes} min)` : ''}, en el calendario y en las horas del día. Pulsa una para agendar la corrección.`,
    none: 'Ningún proyecto en curso en tu cursus',
    pickLabel: 'Proyecto cerrado para agendar su corrección',
    pick: 'Elige un proyecto…',
    noneClosed: 'Ningún proyecto cerrado todavía',
    closedCount: (n: number) =>
      `${n} ${plural(n, 'proyecto cerrado', 'proyectos cerrados')} a la espera de corrección.`,
    closeOneHint: 'Cierra un proyecto en la intra y aparecerá aquí listo para agendar su corrección.',
  },

  /** Motivos de los botones desactivados (subscription.ts). */
  rules: {
    examDisabled:
      'Inscripción a exámenes desactivada: el rol de estudiante no alcanza, se requieren permisos del staff.',
    missingProfileScope:
      'La sesión no tiene el scope "profile", necesario para apuntarse. Actívalo en la app OAuth de la intra, cierra sesión y vuelve a entrar.',
    externalWithLink: 'Evento externo: la inscripción se hace en su web, no en la intra',
    externalNoLink: 'Evento externo: la intra no gestiona su inscripción; busca el enlace en la descripción',
    ended: (exam: boolean): string => (exam ? 'El examen ya ha terminado' : 'El evento ya ha terminado'),
    started: (exam: boolean): string => (exam ? 'El examen ya ha empezado' : 'El evento ya ha empezado'),
    cancellationLimit: (hours: number) => `La intra no permite borrarse a menos de ${hours} h del inicio`,
    overlapsAgenda: 'No puedes apuntarte: se solapa con tu agenda',
    full: 'Aforo completo',
    overlaps: (what: string, more: number) => `Se solapa con ${what}${more ? ` y ${more} más` : ''}`,
    slotPassed: 'La franja ya ha pasado',
    pickProject: 'Elige un proyecto cerrado en "Correcciones" para agendar su corrección',
    projectNotClosed: (name: string) => `${name} aún no está cerrado: no se puede agendar su corrección`,
    noTeam: 'La intra no indica el equipo del proyecto',
    timePassed: 'Esa hora ya ha pasado',
    slotStarted: 'El slot ya ha empezado',
    slotInPast: 'El slot debe empezar en el futuro',
    slotTooShort: (min: number) => `El slot debe durar al menos ${min} minutos`,
    slotGap: (gap: number, what: string) => `Deja ${gap} minutos libres entre slots: queda pegado a ${what}`,
    doesNotFit: (minutes: number) => `La corrección dura ${minutes} min y no cabe empezando a esa hora`,
  },

  /** Mensajes si la API propia falla sin explicar por qué. */
  api: {
    agenda: 'Error al cargar la agenda',
    events: 'Error al cargar los eventos',
    projects: 'Error al cargar los proyectos',
    createSlot: 'No se pudo crear el slot',
    deleteSlot: 'No se pudo borrar el slot',
    freeSlots: 'No se pudieron cargar los slots libres',
    book: 'No se pudo reservar la corrección',
    refresh: 'No se pudo actualizar la agenda',
    generic: 'Error',
  },
}

export type Messages = typeof es
