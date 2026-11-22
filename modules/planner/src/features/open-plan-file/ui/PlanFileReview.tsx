import { fmtDay, fmtHours } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import { diffPlans, HOUR, hm, parseLocal, type Plan, type PlanEvent } from '@lc/plan-domain'
import { Button, calendarColor, Dot, FOOT, META, Modal, TITLE } from '@lc/ui'
import type { ReactNode } from 'react'

import type { OpenedFile } from './OpenPlanFile'

const SHOWN = 8

interface Props {
  file: OpenedFile | null
  current: Plan
  onCancel: () => void
  onOpen: (file: OpenedFile) => void
}

const colorOf = (p: Plan, id: string) => p.calendars.find((c) => c.id === id)?.color
const when = (e: PlanEvent) => `${fmtDay(parseLocal(e.start))} ${hm(parseLocal(e.start))}–${hm(parseLocal(e.end))}`

/** What is in the chosen file and how it differs from the plan on screen, before it is opened. */
export function PlanFileReview({ file, current, onCancel, onOpen }: Props) {
  return (
    <Modal open={!!file} size="wide" onClose={onCancel}>
      {file && <Review file={file} current={current} onCancel={onCancel} onOpen={onOpen} />}
    </Modal>
  )
}

function Review({ file, current, onCancel, onOpen }: Props & { file: OpenedFile }) {
  const { plan } = file
  const diff = diffPlans(current, plan)
  const same = !diff.added.length && !diff.removed.length && !diff.changed.length
  const hours = plan.events.reduce(
    (sum, e) => (e.rrule || e.allDay ? sum : sum + (parseLocal(e.end) - parseLocal(e.start)) / HOUR),
    0,
  )
  const first = plan.events.reduce((min, e) => (e.start < min ? e.start : min), '9999')

  return (
    <>
      <h3 className={TITLE}>{plan.meta.title || file.name}</h3>
      <div className={META}>
        {file.name}
        {plan.meta.generated ? ` · ${m.file_generated({ date: fmtDay(parseLocal(plan.meta.generated)) })}` : ''}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat label={m.stat_events()} value={plan.events.length} />
        <Stat label={m.calendars()} value={plan.calendars.length} />
        <Stat label={m.stat_hours()} value={fmtHours(hours)} />
        <Stat
          label={m.stat_range()}
          value={plan.events.length ? `${fmtDay(parseLocal(first))} – ${fmtDay(parseLocal(plan.meta.planEnd))}` : '—'}
          small
        />
      </dl>

      <ul className="mt-3 flex flex-wrap gap-1.5">
        {plan.calendars.map((c) => (
          <li
            key={c.id}
            className="inline-flex items-center gap-[7px] rounded-full border border-line px-2.5 py-[3px] text-[12.5px]"
            style={calendarColor(c.color)}
          >
            <Dot className="size-2" />
            {c.name}
            <em className="text-muted not-italic tabular-nums">
              {plan.events.filter((e) => e.calendar === c.id).length}
            </em>
          </li>
        ))}
      </ul>

      <h4 className="mt-5 mb-2 text-[14px] font-semibold">{m.file_compare()}</h4>
      {same ? (
        <p className="text-[13.5px] text-muted">{m.file_same()}</p>
      ) : (
        <div className="grid gap-2">
          <Group tone="text-done" sign="+" label={m.file_added({ count: diff.added.length })} count={diff.added.length}>
            {diff.added.slice(0, SHOWN).map((e) => (
              <Row key={e.uid} color={colorOf(plan, e.calendar)} title={e.title} detail={when(e)} />
            ))}
          </Group>
          <Group
            tone="text-today"
            sign="−"
            label={m.file_removed({ count: diff.removed.length })}
            count={diff.removed.length}
          >
            {diff.removed.slice(0, SHOWN).map((e) => (
              <Row key={e.uid} color={colorOf(current, e.calendar)} title={e.title} detail={when(e)} />
            ))}
          </Group>
          <Group
            tone="text-focus"
            sign="~"
            label={m.file_changed({ count: diff.changed.length })}
            count={diff.changed.length}
          >
            {diff.changed.slice(0, SHOWN).map(({ before, after }) => (
              <Row
                key={after.uid}
                color={colorOf(plan, after.calendar)}
                title={after.title}
                detail={
                  before.start === after.start && before.end === after.end
                    ? before.title
                    : `${when(before)} → ${when(after)}`
                }
              />
            ))}
          </Group>
        </div>
      )}

      <div className={FOOT}>
        <Button onClick={onCancel}>{m.cancel()}</Button>
        {/* oxlint-disable-next-line jsx-a11y/no-autofocus -- the dialog exists to confirm this */}
        <Button primary autoFocus onClick={() => onOpen(file)}>
          {m.file_open_in_viewer()}
        </Button>
      </div>
    </>
  )
}

function Stat({ label, value, small = false }: { label: string; value: ReactNode; small?: boolean }) {
  return (
    <div className="rounded-xl bg-surface-2 px-3 py-2.5">
      <dt className="text-[12px] text-muted">{label}</dt>
      <dd className={`font-semibold tabular-nums ${small ? 'text-[13.5px]/[1.5]' : 'font-display text-[20px]/[1.3]'}`}>
        {value}
      </dd>
    </div>
  )
}

interface GroupProps {
  tone: string
  sign: string
  label: string
  count: number
  children: ReactNode
}

function Group({ tone, sign, label, count, children }: GroupProps) {
  if (!count) return null
  return (
    <details className="rounded-xl border border-line-soft px-3 py-2" open={count <= SHOWN}>
      <summary className="cursor-pointer text-[13.5px] font-medium">
        <b className={`mr-1.5 inline-block w-3 text-center ${tone}`}>{sign}</b>
        {label}
      </summary>
      <ul className="mt-2 grid gap-1 text-[13px]">{children}</ul>
      {count > SHOWN && <p className="mt-1.5 text-[12.5px] text-muted">{m.and_more({ count: count - SHOWN })}</p>}
    </details>
  )
}

function Row({ color, title, detail }: { color: string | undefined; title: string; detail: string }) {
  return (
    <li className="flex items-baseline gap-2" style={calendarColor(color)}>
      <Dot className="size-2 -translate-y-px" />
      <span className="min-w-0 flex-1 truncate">{title}</span>
      <em className="flex-none text-[12.5px] text-muted not-italic tabular-nums">{detail}</em>
    </li>
  )
}
