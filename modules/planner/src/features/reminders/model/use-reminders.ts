import { m } from '@lc/i18n/messages'
import { hm, nowMinsk, type Occurrence } from '@lc/plan-domain'
import { useEffect, useState } from 'react'

const REMINDERS_KEY = 'learning-curve:reminders'
/** How long before a start the reminder is shown, in ms */
const LEAD = 10 * 60_000
/** The longest delay a timer takes; a later reminder is set when this one runs out */
const MAX_DELAY = 2 ** 31 - 1

const allowed = () => typeof Notification !== 'undefined' && Notification.permission === 'granted'

/**
 * A system notification ten minutes before each of the `upcoming` events (timed, in order). It works while the
 * planner is open in a tab; the choice is remembered per browser. `supported` is false where the browser has no
 * notifications, `blocked` is true after the person refused them.
 */
export function useReminders(upcoming: Occurrence[]) {
  const [on, setOn] = useState(false)
  const [supported, setSupported] = useState(false)
  const [blocked, setBlocked] = useState(false)
  // Counts the reminders shown, so the next one is set after each.
  const [shown, setShown] = useState(0)

  useEffect(() => {
    setSupported(typeof Notification !== 'undefined')
    try {
      setOn(localStorage.getItem(REMINDERS_KEY) === '1' && allowed())
    } catch {
      // storage unavailable: reminders stay off
    }
  }, [])

  useEffect(() => {
    if (!on) return undefined
    const next = upcoming.find((o) => o.s - LEAD > nowMinsk())
    if (!next) return undefined
    const timer = window.setTimeout(
      () => {
        // The tag replaces a reminder for the same start instead of stacking a second one.
        if (next.s - LEAD <= nowMinsk() && allowed()) {
          void new Notification(next.title, {
            body: m.reminder_body({ time: hm(next.s) }),
            tag: `${next.uid}-${next.s}`,
          })
        }
        setShown((count) => count + 1)
      },
      Math.min(MAX_DELAY, next.s - LEAD - nowMinsk()),
    )
    return () => window.clearTimeout(timer)
  }, [on, upcoming, shown])

  async function toggle() {
    const next = !on
    if (next && !allowed() && (await Notification.requestPermission()) !== 'granted') {
      setBlocked(true)
      return
    }
    setBlocked(false)
    setOn(next)
    try {
      if (next) localStorage.setItem(REMINDERS_KEY, '1')
      else localStorage.removeItem(REMINDERS_KEY)
    } catch {
      // ignore: the choice then lasts until the page is closed
    }
  }

  return { on, supported, blocked, toggle: () => void toggle() }
}
