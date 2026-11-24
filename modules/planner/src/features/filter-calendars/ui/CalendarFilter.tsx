import { m } from '@lc/i18n/messages'
import type { PlanCalendar } from '@lc/plan-domain'
import { calendarColor, Dot, Eye, Plus } from '@lc/ui'

const CHIP =
  'group inline-flex shrink-0 items-center gap-[7px] rounded-full border border-line bg-surface py-[5px] pr-[11px] pl-[9px] text-[13px] whitespace-nowrap'

interface Props {
  /** One chip each, in this order */
  calendars: PlanCalendar[]
  /** Ids of the calendars filtered out: their chips are not pressed */
  hidden: ReadonlySet<string>
  /** Called with the id of the chip that was clicked */
  onToggle: (id: string) => void
  /** Shows only this calendar, or everything again when it is already the only one */
  onSolo: (id: string) => void
  /** Present when something is hidden: adds the chip that brings every calendar back */
  onShowAll?: (() => void) | undefined
  /** Present when calendars can be added and renamed: adds the button that opens their dialog */
  onManage?: (() => void) | undefined
}

/**
 * One chip per calendar. A click hides or shows the calendar; a double click or Alt+click leaves it as the only
 * one, and the same again brings the others back; the eye that appears on a chip under the pointer does the same
 * for those who do not know the gesture. The component keeps no state: the page owns the hidden set.
 */
export function CalendarFilter({ calendars, hidden, onToggle, onSolo, onShowAll, onManage }: Props) {
  return (
    <div
      className="-mx-3 flex w-[calc(100%+24px)] min-w-0 flex-none [scrollbar-width:none] gap-1.5 overflow-x-auto px-3 md:mx-0 md:w-auto md:flex-1 md:flex-wrap md:overflow-visible md:px-0"
      aria-label={m.calendars()}
    >
      {calendars.map((c) => (
        <span key={c.id} className="group/chip relative inline-flex shrink-0">
          <button
            type="button"
            className={`${CHIP} aria-[pressed=false]:border-line-soft aria-[pressed=false]:bg-transparent aria-[pressed=false]:text-muted`}
            style={calendarColor(c.color)}
            aria-pressed={!hidden.has(c.id)}
            title={m.calendar_chip_hint()}
            onClick={(e) => (e.altKey ? onSolo(c.id) : onToggle(c.id))}
            onDoubleClick={() => onSolo(c.id)}
          >
            <Dot className="size-2.5 group-aria-[pressed=false]:bg-transparent group-aria-[pressed=false]:shadow-[inset_0_0_0_2px_var(--c)]" />
            {c.name}
          </button>
          {/* Laid over the end of the chip so the row does not reflow; a touch screen has no hover and keeps the double tap. */}
          <button
            type="button"
            className="absolute top-1/2 right-[3px] grid size-6 -translate-y-1/2 place-items-center rounded-full border border-line bg-surface text-muted opacity-0 group-hover/chip:opacity-100 hover:text-ink focus-visible:opacity-100 [@media(hover:none)]:hidden"
            aria-label={m.calendar_only({ name: c.name })}
            title={m.calendar_only({ name: c.name })}
            onClick={() => onSolo(c.id)}
          >
            <Eye size={14} aria-hidden />
          </button>
        </span>
      ))}
      {onShowAll && (
        <button type="button" className={`${CHIP} font-medium text-focus`} onClick={onShowAll}>
          <Eye size={14} aria-hidden /> {m.calendars_show_all()}
        </button>
      )}
      {onManage && (
        <button type="button" className={`${CHIP} border-dashed text-muted hover:text-ink`} onClick={onManage}>
          <Plus size={14} aria-hidden /> {m.manage_calendars()}
        </button>
      )}
    </div>
  )
}
