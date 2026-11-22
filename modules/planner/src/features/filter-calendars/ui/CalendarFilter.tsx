import { m } from '@lc/i18n/messages'
import type { PlanCalendar } from '@lc/plan-domain'
import { calendarColor, Dot } from '@lc/ui'

const CHIP =
  'group inline-flex shrink-0 items-center gap-[7px] rounded-full border border-line bg-surface py-[5px] pr-[11px] pl-[9px] text-[13px] whitespace-nowrap'

interface Props {
  calendars: PlanCalendar[]
  hidden: ReadonlySet<string>
  onToggle: (id: string) => void
  /** Shows only this calendar, or everything again when it is already the only one */
  onSolo: (id: string) => void
  /** Present when calendars can be added and renamed */
  onManage?: () => void
}

export function CalendarFilter({ calendars, hidden, onToggle, onSolo, onManage }: Props) {
  return (
    <div
      className="-mx-3 flex w-[calc(100%+24px)] min-w-0 flex-none [scrollbar-width:none] gap-1.5 overflow-x-auto px-3 md:mx-0 md:ml-auto md:w-auto md:flex-wrap md:overflow-visible md:px-0"
      aria-label={m.calendars()}
    >
      {calendars.map((c) => (
        <button
          key={c.id}
          type="button"
          className={`${CHIP} aria-[pressed=false]:opacity-45`}
          style={calendarColor(c.color)}
          aria-pressed={!hidden.has(c.id)}
          title={m.calendar_chip_hint()}
          onClick={(e) => (e.altKey ? onSolo(c.id) : onToggle(c.id))}
          onDoubleClick={() => onSolo(c.id)}
        >
          <Dot className="size-2.5 group-aria-[pressed=false]:bg-transparent group-aria-[pressed=false]:shadow-[inset_0_0_0_2px_var(--c)]" />
          {c.name}
        </button>
      ))}
      {onManage && (
        <button type="button" className={`${CHIP} border-dashed text-muted hover:text-ink`} onClick={onManage}>
          ＋ {m.manage_calendars()}
        </button>
      )}
    </div>
  )
}
