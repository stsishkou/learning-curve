const MINUTE = 60_000

/** How the glass is filled: the whole planned session, or work and rest in turns */
export type GlassMode = 'session' | 'short' | 'long' | 'custom'

export interface GlassSettings {
  mode: GlassMode
  /** Minutes of work and of rest in the custom rhythm */
  work: number
  rest: number
  /** No stream, no falling grain, no turn: the sand changes a grain at a time */
  still: boolean
  /** The digits stand alone */
  hidden: boolean
}

export const GLASS_DEFAULTS: GlassSettings = { mode: 'session', work: 30, rest: 5, still: false, hidden: false }
export const WORK_MINUTES = { min: 1, max: 180 } as const
export const REST_MINUTES = { min: 1, max: 60 } as const

/** The classic 25 + 5, and 50 + 10 for longer work */
const RHYTHMS = { short: { work: 25, rest: 5 }, long: { work: 50, rest: 10 } } as const

const MODES: readonly GlassMode[] = ['session', 'short', 'long', 'custom']
const isMode = (value: unknown): value is GlassMode => MODES.some((mode) => mode === value)
/** Whole minutes within the range */
export const clampMinutes = (value: number, { min, max }: { min: number; max: number }) =>
  Math.min(max, Math.max(min, Math.round(value)))
const minutes = (value: unknown, range: { min: number; max: number }, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? clampMinutes(value, range) : fallback

function parse(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/** The settings as stored, read leniently: the plain rhythm stored before the glass (`off`, `short`, `long`) too. */
export function parseSettings(raw: string | null): GlassSettings {
  if (raw === null) return GLASS_DEFAULTS
  if (raw === 'off') return GLASS_DEFAULTS
  if (raw === 'short' || raw === 'long') return { ...GLASS_DEFAULTS, mode: raw }
  const saved = parse(raw)
  if (typeof saved !== 'object' || saved === null) return GLASS_DEFAULTS
  const mode = 'mode' in saved ? saved.mode : null
  return {
    mode: isMode(mode) ? mode : GLASS_DEFAULTS.mode,
    work: minutes('work' in saved ? saved.work : null, WORK_MINUTES, GLASS_DEFAULTS.work),
    rest: minutes('rest' in saved ? saved.rest : null, REST_MINUTES, GLASS_DEFAULTS.rest),
    still: 'still' in saved && saved.still === true,
    hidden: 'hidden' in saved && saved.hidden === true,
  }
}

/** ms of work before a break and of the break; null when the glass holds the whole session */
export function rhythmOf(settings: GlassSettings): { every: number; rest: number } | null {
  if (settings.mode === 'session') return null
  const { work, rest } = settings.mode === 'custom' ? settings : RHYTHMS[settings.mode]
  return { every: work * MINUTE, rest: rest * MINUTE }
}

/** Where a session's glass stands. It is kept per browser, so a reload finds the block and the break it left. */
export interface Sitting {
  /** The session */
  uid: string
  /** Stopwatch ms at which the work block began */
  from: number
  /** Epoch ms when the break being taken ends; null at work */
  restUntil: number | null
  /** ms of that break */
  rest: number
}

export function parseSitting(raw: string | null): Sitting | null {
  const saved = raw === null ? null : parse(raw)
  if (typeof saved !== 'object' || saved === null) return null
  if (!('uid' in saved) || typeof saved.uid !== 'string') return null
  if (!('from' in saved) || typeof saved.from !== 'number') return null
  const restUntil = 'restUntil' in saved && typeof saved.restUntil === 'number' ? saved.restUntil : null
  const rest = 'rest' in saved && typeof saved.rest === 'number' ? saved.rest : 0
  return { uid: saved.uid, from: saved.from, restUntil, rest }
}

/** What the glass shows now */
export interface Block {
  kind: 'work' | 'rest'
  /** ms of the whole block */
  length: number
  /** ms of it that have run, 0…length */
  run: number
  /** Names the block: a new one turns the glass over */
  key: string
}

interface Moment {
  settings: GlassSettings
  sitting: Sitting | null
  /** The session timed */
  uid: string
  /** Its planned length in ms */
  planned: number
  /** The stopwatch's time for it */
  elapsed: number
  /** Epoch ms */
  now: number
}

const span = (run: number, length: number) => Math.min(length, Math.max(0, run))

/**
 * The block under way. Work is measured on the stopwatch, so a pause holds the sand; a break is a wall-clock
 * deadline, so it ends on time while the stopwatch stands. A sitting of another session counts for nothing, and
 * one that began after the stopwatch's time is from before a reset.
 */
export function blockOf({ settings, sitting, uid, planned, elapsed, now }: Moment): Block {
  const own = sitting?.uid === uid ? sitting : null
  if (own && own.restUntil !== null) {
    return {
      kind: 'rest',
      length: own.rest,
      run: span(own.rest - (own.restUntil - now), own.rest),
      key: `${uid}:rest:${own.restUntil}`,
    }
  }
  const rhythm = rhythmOf(settings)
  if (!rhythm) {
    const length = Math.max(MINUTE, planned)
    return { kind: 'work', length, run: span(elapsed, length), key: `${uid}:session` }
  }
  const from = own && own.from <= elapsed ? own.from : 0
  return { kind: 'work', length: rhythm.every, run: span(elapsed - from, rhythm.every), key: `${uid}:work:${from}` }
}
