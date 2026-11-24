import { fmtDay } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import { parseLocal, type Plan, type PlanEvent } from '@lc/plan-domain'
import { calendarColor, Dot } from '@lc/ui'

interface Props {
  /** Gives the calendars' colors */
  plan: Plan
  /** The sessions whose time has passed and that are not done */
  events: PlanEvent[]
  /** Opens a session: its dialog has the date and the time, the way for a keyboard or a finger */
  onSelect: (event: PlanEvent) => void
  /** Called with the session picked up by the pointer, and with null when it is let go: the grid takes the drop */
  onCarry: (event: PlanEvent | null) => void
}

/** What the drag carries: a drop outside the page, into a text field or another app, gets the title. */
const TEXT = 'text/plain'
// The dot names the course, as on the grid: the chip keeps the room for the topic.
const topic = (e: PlanEvent) => e.title.replace(/^[^—]+— /, '')

/**
 * The sessions that missed their time, as chips to drag onto a new slot of the calendar. Opening one is the other
 * way to give it a time.
 */
export function Backlog({ plan, events, onSelect, onCarry }: Props) {
  if (!events.length) return null
  const colorOf = (id: string) => plan.calendars.find((c) => c.id === id)?.color
  return (
    <section aria-label={m.backlog()} className="mb-3 grid gap-1.5">
      <p className="text-[12.5px] text-muted">{m.backlog_hint()}</p>
      <ul className="flex gap-1.5 overflow-x-auto pb-1">
        {events.map((e) => (
          <li key={e.uid} className="flex-none" style={calendarColor(colorOf(e.calendar))}>
            <button
              type="button"
              draggable
              title={e.title}
              className="flex max-w-[260px] cursor-grab items-baseline gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1 text-left text-[12.5px] hover:bg-surface-2 active:cursor-grabbing"
              onClick={() => onSelect(e)}
              onDragStart={(ev) => {
                ev.dataTransfer.effectAllowed = 'move'
                ev.dataTransfer.setData(TEXT, e.title)
                onCarry(e)
              }}
              onDragEnd={() => onCarry(null)}
            >
              <Dot className="size-2 flex-none -translate-y-px" />
              <span className="min-w-0 truncate font-medium">{topic(e)}</span>
              <span className="flex-none text-muted tabular-nums">{fmtDay(parseLocal(e.start))}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
