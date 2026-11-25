import { useEffect, useRef, useState } from 'react'

import {
  blockOf,
  clampMinutes,
  GLASS_DEFAULTS,
  parseSettings,
  parseSitting,
  REST_MINUTES,
  rhythmOf,
  WORK_MINUTES,
  type GlassMode,
  type GlassSettings,
  type Sitting,
} from './blocks'
import { chime, unlockSound } from './sound'
import { useClock, useWake } from './use-clock'
import type { Stopwatch } from './use-stopwatch'

// Its old value, a plain rhythm, is still read: see `parseSettings`.
const SETTINGS_KEY = 'learning-curve:focus-breaks'
const SITTING_KEY = 'learning-curve:focus-glass'

function load(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function store(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // ignore: the choice then lasts until the page is closed
  }
}

/**
 * The page's clock and the glass of the session `uid` over the stopwatch. The glass holds the whole planned session
 * or a work block of the rhythm; when a block runs out it chimes once. Taking a break counts the rest down on the
 * wall clock while the stopwatch stands, and "Later" turns the glass for another block. The settings are kept per
 * browser, the place in the rhythm per session, so a reload finds both.
 */
export function useGlass(uid: string | null, planned: number, watch: Stopwatch) {
  const [settings, setSettings] = useState<GlassSettings>(GLASS_DEFAULTS)
  const [sitting, setSitting] = useState<Sitting | null>(null)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    setSettings(parseSettings(load(SETTINGS_KEY)))
    setSitting(parseSitting(load(SITTING_KEY)))
    setReady(true)
  }, [])

  const timed = uid !== null && watch.timed === uid
  const running = timed && watch.running
  const own = uid !== null && sitting?.uid === uid ? sitting : null
  const restUntil = own?.restUntil ?? null
  const { now, refresh } = useClock(running || restUntil !== null)
  const elapsed = timed ? watch.elapsedAt(now) : 0
  const block = blockOf({ settings, sitting, uid: uid ?? '', planned, elapsed, now })
  const rhythm = rhythmOf(settings)
  const ended = block.run >= block.length
  const moving = !ended && (block.kind === 'rest' || running)
  // While the stopwatch runs, the moment the block ends does not move: it is set once.
  useWake(moving ? (block.kind === 'rest' ? restUntil : now + block.length - block.run) : null, refresh)

  // Only an end seen happening chimes: a reload that finds the glass empty does not.
  const seen = useRef<{ key: string; ended: boolean } | null>(null)
  useEffect(() => {
    if (!ready || !watch.ready || now === 0) return
    const last = seen.current
    seen.current = { key: block.key, ended }
    if (last?.key === block.key && !last.ended && ended) chime()
  }, [ready, watch.ready, now, block.key, ended])

  const keep = (next: Sitting | null) => {
    store(SITTING_KEY, next && JSON.stringify(next))
    setSitting(next)
  }
  const save = (next: GlassSettings) => {
    store(SETTINGS_KEY, JSON.stringify(next))
    setSettings(next)
  }
  /** A new block from the stopwatch's time now: work, or a rest of `rest` ms */
  const turn = (rest: number | null) => {
    if (uid === null) return
    const at = Date.now()
    keep({ uid, from: timed ? watch.elapsedAt(at) : 0, restUntil: rest === null ? null : at + rest, rest: rest ?? 0 })
    refresh()
  }

  return {
    ready: ready && watch.ready,
    settings,
    /** Epoch ms that `elapsed` and `block` were worked out for */
    now,
    /** The stopwatch's time for the session */
    elapsed,
    block,
    /** ms of work before a break and of the break; null when the glass holds the session */
    rhythm,
    /** The sand is falling */
    moving,
    /** The work block has run out: a break is due */
    due: rhythm !== null && block.kind === 'work' && ended,
    resting: block.kind === 'rest' && !ended,
    /** The break has run out; it lasts until work resumes */
    rested: block.kind === 'rest' && ended,
    /** The glass of the whole session has run out */
    out: rhythm === null && ended,
    choose: (mode: GlassMode) => {
      unlockSound()
      save({ ...settings, mode })
      turn(null)
    },
    /** The minutes of the custom rhythm, kept within their ranges */
    setMinutes: (part: { work?: number; rest?: number }) =>
      save({
        ...settings,
        work: part.work === undefined ? settings.work : clampMinutes(part.work, WORK_MINUTES),
        rest: part.rest === undefined ? settings.rest : clampMinutes(part.rest, REST_MINUTES),
      }),
    toggleStill: () => save({ ...settings, still: !settings.still }),
    toggleHidden: () => save({ ...settings, hidden: !settings.hidden }),
    /** Starts the break: the page pauses the stopwatch */
    take: () => {
      if (!rhythm) return
      unlockSound()
      turn(rhythm.rest)
    },
    /** Works on through the break: the glass turns for another block */
    skip: () => {
      unlockSound()
      turn(null)
    },
    /** Called as the stopwatch starts or resumes: whatever was left of a break is given up */
    resume: () => {
      unlockSound()
      if (own && own.restUntil !== null) keep({ ...own, restUntil: null })
    },
    reset: () => keep(null),
  }
}
