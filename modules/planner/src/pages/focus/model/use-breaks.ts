import { useEffect, useRef, useState } from 'react'

const MINUTE = 60_000
const BREAKS_KEY = 'learning-curve:focus-breaks'

/** How long to study before a rest, and how long the rest is: the classic 25 + 5, and 50 + 10 for longer work. */
export const BREAK_RHYTHMS = {
  off: null,
  short: { every: 25 * MINUTE, rest: 5 * MINUTE },
  long: { every: 50 * MINUTE, rest: 10 * MINUTE },
} as const

export type BreakRhythm = keyof typeof BREAK_RHYTHMS

const isRhythm = (value: unknown): value is BreakRhythm => value === 'off' || value === 'short' || value === 'long'

function readRhythm(): BreakRhythm {
  try {
    const saved = localStorage.getItem(BREAKS_KEY)
    return isRhythm(saved) ? saved : 'off'
  } catch {
    return 'off'
  }
}

function writeRhythm(rhythm: BreakRhythm) {
  try {
    localStorage.setItem(BREAKS_KEY, rhythm)
  } catch {
    // ignore: the choice then lasts until the page is closed
  }
}

/** Two short notes through Web Audio. Where sound is not allowed it stays silent: the page says it in words too. */
function chime() {
  try {
    const audio = new AudioContext()
    for (const [index, frequency] of [660, 880].entries()) {
      const tone = audio.createOscillator()
      const volume = audio.createGain()
      const at = audio.currentTime + index * 0.18
      tone.frequency.value = frequency
      volume.gain.setValueAtTime(0.0001, at)
      volume.gain.exponentialRampToValueAtTime(0.2, at + 0.02)
      volume.gain.exponentialRampToValueAtTime(0.0001, at + 0.16)
      tone.connect(volume).connect(audio.destination)
      tone.start(at)
      tone.stop(at + 0.17)
    }
    window.setTimeout(() => void audio.close(), 600)
  } catch {
    // no audio here
  }
}

/**
 * Breaks for the focus stopwatch. `elapsed` is the study time of the session so far; after every `every` of it a
 * break is due and a chime sounds. Taking it starts a countdown of `rest` (the page pauses the stopwatch), and its
 * end chimes again; running the stopwatch earlier ends it. Skipping moves the next one a whole rhythm on.
 */
export function useBreaks(elapsed: number, running: boolean) {
  const [rhythm, setRhythm] = useState<BreakRhythm>('off')
  // Break points already taken or skipped, counted from the start of the session.
  const [handled, setHandled] = useState(0)
  const [restUntil, setRestUntil] = useState<number | null>(null)
  const [rested, setRested] = useState(false)
  const [clock, setClock] = useState(0)
  useEffect(() => setRhythm(readRhythm()), [])

  const plan = BREAK_RHYTHMS[rhythm]
  const due = plan !== null && restUntil === null && elapsed >= (handled + 1) * plan.every
  const resting = restUntil === null ? null : Math.max(0, restUntil - clock)

  // A stopwatch that starts again from nothing starts the rhythm again.
  useEffect(() => {
    if (elapsed === 0) setHandled(0)
  }, [elapsed])

  // Back at work: whatever was left of the break is given up.
  useEffect(() => {
    if (!running) return
    setRestUntil(null)
    setRested(false)
  }, [running])

  const wasDue = useRef(false)
  useEffect(() => {
    if (due && !wasDue.current) chime()
    wasDue.current = due
  }, [due])

  useEffect(() => {
    if (restUntil === null) return undefined
    const timer = window.setInterval(() => {
      const now = Date.now()
      setClock(now)
      if (now < restUntil) return
      setRestUntil(null)
      setRested(true)
      chime()
    }, 1000)
    return () => window.clearInterval(timer)
  }, [restUntil])

  const passBreakPoint = () => {
    if (plan) setHandled(Math.floor(elapsed / plan.every))
  }

  return {
    rhythm,
    /** The rest the current rhythm asks for, in ms; 0 without breaks */
    rest: plan?.rest ?? 0,
    due,
    /** ms left of the break being taken; null when there is none */
    resting,
    /** True from the end of a break until the stopwatch runs again */
    rested,
    choose: (next: BreakRhythm) => {
      writeRhythm(next)
      setRhythm(next)
      setHandled(next === 'off' ? 0 : Math.floor(elapsed / BREAK_RHYTHMS[next].every))
    },
    take: () => {
      if (!plan) return
      passBreakPoint()
      setClock(Date.now())
      setRestUntil(Date.now() + plan.rest)
    },
    skip: passBreakPoint,
  }
}
