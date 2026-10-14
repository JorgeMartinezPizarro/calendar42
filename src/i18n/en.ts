// English texts: simple English for campuses outside Spain. Same shape as es.ts.

import type { Messages } from './es.ts'

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)

export const en: Messages = {
  // en-GB: day before month and 24-hour clock, as on the intra in Europe.
  locale: 'en-GB',
  weekdays: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],

  common: {
    retry: 'Retry',
    loading: 'Loading…',
    oneMoment: 'One moment…',
    close: 'Close',
    cancel: 'Cancel',
  },

  language: {
    label: 'Language',
    es: 'Español',
    en: 'English',
  },

  app: {
    tagline: (campus) => (campus ? `Calendar for 42 ${campus} students` : 'Calendar for 42 students'),
    demoBadge: 'Demo mode',
    demoBadgeTitle: 'Sample data, the intra is not touched',
    agendaError: (message) => `Could not load the agenda: ${message}`,
    intraNoResponse: (n) => `The intra did not respond for ${n} ${plural(n, 'source', 'sources')}`,
    sourcesWithWarning: (n) => `${n} ${plural(n, 'source', 'sources')} with a warning`,
    coalition: 'Coalition',
    coalitionTitle: (name) => `Coalition: ${name}`,
    logout: 'Log out',
    upcomingExams: 'Upcoming exams',
    noExams: 'No exams available in the next month',
    upcomingEvents: 'Upcoming events',
    noEvents: 'No upcoming events on the intra',
    splash: 'Loading…',
  },

  warnings: {
    sources: {
      event: 'Events',
      exam: 'Exams',
      slot: 'Open slots',
      correction: 'Evaluations',
      free: 'Free slots',
      myEvents: 'My events',
      myExams: 'My exams',
    },
    missingScope: 'The session lacks the "projects" scope. Log out and log in again.',
  },

  export: {
    button: 'Export',
    busy: 'Exporting…',
    title: 'Download your agenda as .ics to import it into Google Calendar, Outlook or Apple Calendar',
    ariaLabel: 'Export the agenda in iCalendar format (.ics)',
    nothing: 'Nothing to export: your agenda is empty from today on.',
    done: (n) =>
      `Downloaded with ${n} ${plural(n, 'item', 'items')}. In Google Calendar: Settings → Import & export → Import. Importing it again updates it without duplicates.`,
    failed: (message) => `Could not export: ${message}`,
    signup: 'Sign-up',
  },

  source: 'Source code on GitHub',

  calendar: {
    label: 'Monthly calendar',
    prevMonth: 'Previous month',
    nextMonth: 'Next month',
    today: 'Today',
  },

  types: {
    event: 'Events',
    exam: 'Exams',
    slot: 'Open slots',
    correction: 'Evaluations',
    free: 'Free slots',
  },

  itemType: {
    event: 'Event',
    exam: 'Exam',
    slot: 'Evaluation slot',
    correction: 'Evaluation',
    free: 'Free evaluation slot',
  },

  kinds: {
    conference: 'Conference',
    meetup: 'Meetup',
    workshop: 'Workshop',
    atelier: 'Workshop',
    rush: 'Rush',
    hackathon: 'Hackathon',
    extern: 'External',
    association: 'Association',
    partnership: 'Partner',
    challenge: 'Challenge',
    piscine: 'Piscine',
    pedago: 'Pedagogy',
  },

  modes: {
    nav: 'Mode',
    events: 'Events',
    corrections: 'Evaluations',
    exams: 'Exams',
    slots: 'Create slots',
  },

  login: {
    subtitle: 'Calendar for 42 students: events, exams, slots and evaluations in one agenda',
    with42: 'Log in with 42',
    notConfigured:
      'The server has no 42 OAuth app configured. Add FT_CLIENT_ID and FT_CLIENT_SECRET to .env to log in with the intra.',
    demo: 'Try the demo',
    demoBusy: 'Entering…',
    demoTitle: 'Sample data, the intra is not touched',
    errors: {
      state: 'The intra response was not valid. Please try again.',
      exchange: 'Could not complete the login with the intra.',
      access_denied: 'You cancelled the authorization on the intra.',
    },
  },

  items: {
    openSlot: 'Open evaluation slot',
    slotDescription: (blocks) => `Available to evaluate (${blocks} × 15 min)`,
    freeSlot: 'Free evaluation slot',
    freeSlotOf: (login) => `Free slot · ${login}`,
    freeDescription: (blocks) => `A student can evaluate you in this time slot (${blocks} × 15 min).`,
    correction: (project) => `Evaluation: ${project}`,
    youEvaluate: 'You evaluate',
    youAreEvaluated: 'You are evaluated',
    corrector: 'Evaluator',
    correcteds: 'Evaluated',
    team: 'Team',
    evaluationDone: (mark) => `Evaluation submitted${mark != null ? ` · mark ${mark}` : ''}`,
    bookedHere: 'Booked from Calendar42 (demo)',
    evaluationLasts: (minutes) => `This project's evaluation lasts ${minutes} min.`,
    examProjects: 'Projects',
    examCursus: 'Cursus',
    examIp: 'IP',
  },

  list: {
    subscribed: 'signed up',
    external: 'external',
  },

  popover: {
    externalSignup: 'External sign-up',
    subscribed: 'Signed up',
    when: 'When',
    where: 'Where',
    capacity: 'Capacity',
    corrector: 'Evaluator',
    people: (n) => `${n} signed up`,
    seats: (n) => `${n} seats`,
    subscribe: 'Sign up',
    unsubscribe: 'Leave',
    signupOnWeb: 'Sign up on their website ↗',
    startAt: 'Start at',
    clashes: ' · clashes',
    book: 'Book evaluation',
    bookProject: (project) => `Book evaluation of ${project}`,
    deleteSlot: 'Delete slot',
    slotBusy: 'Busy',
    slotFree: 'Free',
    slotBusyTitle: 'Overlaps with something in your agenda',
    slotFreeTitle: 'Does not overlap with anything in your agenda',
    overlapsWith: 'Overlaps with',
  },

  day: {
    label: 'Day view by hours',
    panelLabel: 'Item details',
    backToMonth: 'Back to the month',
    today: 'Today',
    nothing: 'Nothing planned',
    count: (n) => `${n} ${plural(n, 'item', 'items')}`,
    prevDay: 'Previous day',
    nextDay: 'Next day',
    selectHint: 'Drag with the mouse or tap an hour to create a slot; adjust it with the handles',
    subscribedBadge: 'Signed up',
    newSlot: 'New slot',
    slotStart: 'Slot start',
    slotEnd: 'Slot end',
    now: (time) => `Current time ${time}`,
    metaFree: 'tap to book',
    metaCorrector: 'you evaluate',
    metaCorrected: 'you are evaluated',
    metaDone: 'done',
  },

  slots: {
    label: 'Create an evaluation slot',
    title: 'Create slot',
    hint: (min, gap) =>
      `Pick a day and mark when you can evaluate: drag over the hours with the mouse or tap an hour with your finger. Then adjust it with the handles or the 15-minute buttons. Slots come in 15-minute blocks, last at least ${min} minutes and need ${gap} free minutes between them.`,
    pending: (range) => `New slot · ${range}`,
    start: 'Start',
    end: 'End',
    earlier: (label) => `${label} 15 minutes earlier`,
    later: (label) => `${label} 15 minutes later`,
    create: 'Create slot',
    creating: 'Creating…',
    created: (range) => `Slot created: ${range}. You can delete it from its card.`,
  },

  projects: {
    label: 'Student projects',
    title: 'Evaluations',
    status: {
      waiting_for_correction: 'Closed, waiting for evaluation',
      in_progress: 'In progress',
      searching_a_group: 'Looking for a group',
      creating_group: 'Creating a group',
    },
    groupClosed: 'Closed, ready for evaluation',
    groupOpen: 'In progress, not closed yet',
    notClosedYet: 'Its evaluation can be booked once you close the project.',
    searchingSlots: 'Looking for free slots…',
    noFreeSlots: 'No free slots this month to evaluate this project.',
    noFreeSlotsFor: (minutes) => `No free time this month long enough for this project's evaluation (${minutes} min).`,
    freeSlots: (n, minutes) =>
      `${n} free ${plural(n, 'slot', 'slots')} this month${minutes ? ` long enough for the evaluation (${minutes} min)` : ''}, in the calendar and in the day hours. Tap one to book the evaluation.`,
    none: 'No projects in progress in your cursus',
    pickLabel: 'Closed project to book its evaluation',
    pick: 'Pick a project…',
    noneClosed: 'No closed projects yet',
    closedCount: (n) => `${n} closed ${plural(n, 'project', 'projects')} waiting for evaluation.`,
    closeOneHint: 'Close a project on the intra and it will show up here, ready to book its evaluation.',
  },

  rules: {
    examDisabled: 'Exam sign-up is disabled: the student role is not enough, staff permissions are required.',
    missingProfileScope:
      'The session lacks the "profile" scope needed to sign up. Enable it in the intra OAuth app, log out and log in again.',
    externalWithLink: 'External event: sign up on their website, not on the intra',
    externalNoLink: 'External event: the intra does not handle its sign-up; look for the link in the description',
    ended: (exam) => (exam ? 'The exam has already ended' : 'The event has already ended'),
    started: (exam) => (exam ? 'The exam has already started' : 'The event has already started'),
    cancellationLimit: (hours) => `The intra does not allow leaving less than ${hours} h before the start`,
    overlapsAgenda: 'You cannot sign up: it overlaps with your agenda',
    full: 'Full',
    overlaps: (what, more) => `Overlaps with ${what}${more ? ` and ${more} more` : ''}`,
    slotPassed: 'This time slot has already passed',
    pickProject: 'Pick a closed project in "Evaluations" to book its evaluation',
    projectNotClosed: (name) => `${name} is not closed yet: its evaluation cannot be booked`,
    noTeam: 'The intra does not say which team the project belongs to',
    timePassed: 'That time has already passed',
    slotStarted: 'The slot has already started',
    slotInPast: 'The slot must start in the future',
    slotTooShort: (min) => `The slot must last at least ${min} minutes`,
    slotGap: (gap, what) => `Leave ${gap} free minutes between slots: it touches ${what}`,
    doesNotFit: (minutes) => `The evaluation lasts ${minutes} min and does not fit starting at that time`,
  },

  api: {
    agenda: 'Error loading the agenda',
    events: 'Error loading the events',
    projects: 'Error loading the projects',
    createSlot: 'Could not create the slot',
    deleteSlot: 'Could not delete the slot',
    freeSlots: 'Could not load the free slots',
    book: 'Could not book the evaluation',
    generic: 'Error',
  },
}
