import { m } from '@lc/i18n/messages'
import type { PlanCalendar } from '@lc/plan-domain'
import { calendarColor, Dot } from '@lc/ui'
import { useId } from 'react'

const CHIP =
  'inline-flex cursor-pointer items-center gap-[7px] rounded-full border border-line-soft py-[5px] pr-[11px] pl-[9px] text-[13px] whitespace-nowrap text-muted hover:text-ink has-checked:border-cal has-checked:bg-[color-mix(in_srgb,var(--c)_12%,var(--surface))] has-checked:text-ink has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus'

interface Props {
  calendars: PlanCalendar[]
  /** Ids of the calendars picked, in the order of `calendars`; empty for all of them */
  value: readonly string[]
  /** One calendar or none: the chips work as radio buttons and there is no chip for all */
  single: boolean
  onChange: (ids: string[]) => void
}

/** The calendars a reschedule takes: all of them, several, or one when `single`. */
export function CalendarPicker({ calendars, value, single, onChange }: Props) {
  const ids = useId()
  const picked = new Set(value)
  const toggle = (id: string) =>
    onChange(calendars.map((c) => c.id).filter((other) => (other === id) !== picked.has(other)))

  return (
    <div className="grid gap-1.5" role={single ? 'radiogroup' : 'group'} aria-labelledby={`${ids}-label`}>
      <span id={`${ids}-label`} className="text-[13px] text-muted">
        {m.calendars()}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {!single && (
          <label className={CHIP} style={calendarColor('var(--focus)')}>
            <input type="checkbox" className="sr-only" checked={!value.length} onChange={() => onChange([])} />
            {m.shift_all()}
          </label>
        )}
        {calendars.map((c) => (
          <label key={c.id} className={CHIP} style={calendarColor(c.color)}>
            <input
              type={single ? 'radio' : 'checkbox'}
              name={`${ids}-calendar`}
              className="peer sr-only"
              checked={single ? value.length === 1 && picked.has(c.id) : picked.has(c.id)}
              onChange={() => (single ? onChange([c.id]) : toggle(c.id))}
            />
            <Dot className="size-2.5 peer-not-checked:bg-transparent peer-not-checked:shadow-[inset_0_0_0_2px_var(--c)]" />
            {c.name}
          </label>
        ))}
      </div>
    </div>
  )
}
