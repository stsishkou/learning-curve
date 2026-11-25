import { m } from '@lc/i18n/messages'
import { planLabels, type PlanCalendar } from '@lc/plan-domain'
import { Segmented } from '@lc/ui'

interface Props {
  /** The calendars on screen; nothing is drawn unless one of them has a label */
  calendars: PlanCalendar[]
  /** Ids of the calendars filtered out */
  hidden: ReadonlySet<string>
  /** Leaves only these calendars on screen */
  onOnly: (ids: string[]) => void
  onShowAll: () => void
}

const ALL = 'all'
const NONE = 'none'

/**
 * All, each label with how many calendars carry it, and No label: a click leaves only those calendars on screen, a
 * click on the pressed one brings every calendar back. It drives the same filter as the calendar chips.
 */
export function LabelFilter({ calendars, hidden, onOnly, onShowAll }: Props) {
  const labels = planLabels({ calendars })
  if (!labels.length) return null
  const unlabelled = calendars.filter((c) => !c.labels?.length).map((c) => c.id)
  // Prefixed, so no label's name can stand for All or No label.
  const groups = new Map(labels.map((label) => [`label:${label.name}`, label.calendars]))
  if (unlabelled.length) groups.set(NONE, unlabelled)
  const onlyThese = (ids: string[]) => calendars.every((c) => ids.includes(c.id) !== hidden.has(c.id))
  const value = calendars.every((c) => !hidden.has(c.id))
    ? ALL
    : ([...groups].find(([, ids]) => onlyThese(ids))?.[0] ?? '')
  const options = [
    { value: ALL, label: m.label_all() },
    ...labels.map((label) => ({ value: `label:${label.name}`, label: `${label.name} · ${label.calendars.length}` })),
    ...(unlabelled.length ? [{ value: NONE, label: `${m.label_none()} · ${unlabelled.length}` }] : []),
  ]

  return (
    <div className="-mx-3 w-[calc(100%+24px)] basis-full [scrollbar-width:none] overflow-x-auto px-3 text-[13px] whitespace-nowrap md:mx-0 md:w-auto md:px-0">
      <Segmented
        label={m.labels()}
        value={value}
        options={options}
        onChange={(next) => {
          const ids = groups.get(next)
          if (next === ALL || next === value || !ids) onShowAll()
          else onOnly(ids)
        }}
      />
    </div>
  )
}
