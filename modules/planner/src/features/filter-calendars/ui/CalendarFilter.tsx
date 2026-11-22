import { m } from '@lc/i18n/messages'
import type { PlanCalendar } from '@lc/plan-domain'
import { Dot, calendarColor } from '@lc/ui'

interface Props {
  calendars: PlanCalendar[]
  hidden: ReadonlySet<string>
  onToggle: (id: string) => void
}

export function CalendarFilter({ calendars, hidden, onToggle }: Props) {
  return (
    <div
      className="-mx-3 flex min-w-0 flex-1 [scrollbar-width:none] gap-1.5 overflow-x-auto px-3 md:mx-0 md:ml-auto md:flex-none md:flex-wrap md:overflow-visible md:px-0"
      aria-label={m.calendars()}
    >
      {calendars.map((c) => (
        <button
          key={c.id}
          type="button"
          className="group inline-flex shrink-0 items-center gap-[7px] rounded-full border border-line bg-surface py-[5px] pr-[11px] pl-[9px] text-[13px] whitespace-nowrap aria-[pressed=false]:opacity-45"
          style={calendarColor(c.color)}
          aria-pressed={!hidden.has(c.id)}
          onClick={() => onToggle(c.id)}
        >
          <Dot className="size-2.5 group-aria-[pressed=false]:bg-transparent group-aria-[pressed=false]:shadow-[inset_0_0_0_2px_var(--c)]" />
          {c.name}
        </button>
      ))}
    </div>
  )
}
