import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { downloadBlob, zipBlob } from '#/lib/client'
import { fmtDay } from '#/lib/format'
import { hm, parseLocal } from '#/lib/plan/dates'
import { buildICS, icsFileName, IMPORT_HOWTO } from '#/lib/plan/ics'
import type { Plan, PlanEvent } from '#/lib/plan/types'
import { m } from '#/paraglide/messages.js'

import { Button, Dot, calendarColor } from './ui'

const TITLE = 'mb-1 text-[18px]/[1.3] font-semibold'
const META = 'flex flex-wrap items-center gap-2 text-[13.5px] text-muted'
const FOOT = 'mt-[18px] flex flex-wrap justify-end gap-2'

function Modal({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dlg = ref.current
    if (!dlg) return
    if (open && !dlg.open) dlg.showModal()
    if (!open && dlg.open) dlg.close()
  }, [open])
  return (
    // A click on the backdrop closes the dialog; the keyboard path is the native Esc handling.
    // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={ref}
      // m-auto: Tailwind's reset zeroes the margin that centers a modal dialog
      className="m-auto w-[min(560px,calc(100vw-32px))] rounded-2xl border border-line bg-surface text-ink shadow-[0_24px_60px_rgb(10_16_30/0.25)] backdrop:bg-[rgb(10_16_30/0.45)]"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
    >
      <div className="px-[22px] py-5">{children}</div>
    </dialog>
  )
}

const linkify = (text: string) =>
  text.split(/(https?:\/\/\S+)/g).map((part, i) =>
    /^https?:\/\//.test(part) ? (
      // oxlint-disable-next-line react/no-array-index-key -- the parts of one description never reorder
      <a key={i} className="text-focus underline" href={part} target="_blank" rel="noreferrer">
        {part}
      </a>
    ) : (
      part
    ),
  )

export function EventDialog({ plan, event, onClose }: { plan: Plan; event: PlanEvent | null; onClose: () => void }) {
  const calendar = plan.calendars.find((c) => c.id === event?.calendar)
  let when = ''
  if (event) {
    const s = parseLocal(event.start)
    const e = parseLocal(event.end)
    when = event.rrule
      ? m.event_recurring({ from: hm(s), to: hm(e), date: fmtDay(s) })
      : event.allDay
        ? m.event_all_day({ date: fmtDay(s) })
        : `${fmtDay(s)} ${hm(s)}–${hm(e)}`
  }
  return (
    <Modal open={!!event} onClose={onClose}>
      {event && (
        <>
          <h3 className={TITLE}>{event.title}</h3>
          <div className={META} style={calendarColor(calendar?.color)}>
            <Dot className="size-2.5" />
            {calendar?.name}, {when}
            {event.availability === 'free' ? `, ${m.event_free()}` : ''}
          </div>
          {event.description && (
            <pre className="mt-3.5 rounded-[10px] bg-surface-2 px-3.5 py-3 font-sans text-[14px]/[1.55] wrap-anywhere whitespace-pre-wrap">
              {linkify(event.description)}
            </pre>
          )}
          <div className={FOOT}>
            <Button onClick={onClose}>{m.close()}</Button>
          </div>
        </>
      )}
    </Modal>
  )
}

export function ExportDialog({
  plan,
  hidden,
  open,
  onClose,
}: {
  plan: Plan
  hidden: ReadonlySet<string>
  open: boolean
  onClose: () => void
}) {
  const counts = useMemo(
    () => Object.fromEntries(plan.calendars.map((c) => [c.id, plan.events.filter((e) => e.calendar === c.id).length])),
    [plan],
  )
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [status, setStatus] = useState('')
  useEffect(() => {
    if (open) {
      setSelected(new Set(plan.calendars.filter((c) => counts[c.id] && !hidden.has(c.id)).map((c) => c.id)))
      setStatus('')
    }
  }, [open, plan, hidden, counts])

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  async function downloadZip() {
    const ids = plan.calendars.filter((c) => selected.has(c.id))
    if (!ids.length) return setStatus(m.export_select_calendar())
    const files: Record<string, string> = {
      'Как импортировать.txt': IMPORT_HOWTO(ids.filter((c) => c.isNew).map((c) => c.name)),
    }
    for (const c of ids)
      files[icsFileName(c)] = buildICS(
        c,
        plan.events.filter((e) => e.calendar === c.id),
        plan.meta.timezone,
      )
    downloadBlob(`plan-ics-${plan.meta.generated}.zip`, await zipBlob(files))
    setStatus(m.export_done({ count: ids.length }))
  }

  function downloadOne(id: string) {
    const c = plan.calendars.find((it) => it.id === id)!
    downloadBlob(
      icsFileName(c),
      buildICS(
        c,
        plan.events.filter((e) => e.calendar === id),
        plan.meta.timezone,
      ),
      'text/calendar',
    )
  }

  return (
    <Modal open={open} onClose={onClose}>
      <h3 className={TITLE}>{m.export_to_calendar()}</h3>
      <div className={META}>{m.export_hint()}</div>
      <div className="mt-3.5 mb-1.5 grid gap-1">
        {plan.calendars.map((c) => (
          <label
            key={c.id}
            className="flex items-center gap-2.5 rounded-lg px-2 py-[7px] hover:bg-surface-2"
            style={calendarColor(c.color)}
          >
            <input
              type="checkbox"
              checked={selected.has(c.id)}
              disabled={!counts[c.id]}
              onChange={() => toggle(c.id)}
            />
            <Dot className="size-2.5" />
            {c.name}
            {c.isNew && (
              <span className="rounded-md border border-current px-[5px] text-[11.5px] text-focus">
                {m.create_calendar()}
              </span>
            )}
            <em className="ml-auto text-[13px] text-muted not-italic tabular-nums">
              {m.events_count({ count: counts[c.id] })}
            </em>
            {counts[c.id] > 0 && (
              <button
                type="button"
                className="ml-1.5 rounded-md border border-line bg-surface px-[7px] py-px text-[12px]"
                onClick={(e) => (e.preventDefault(), downloadOne(c.id))}
              >
                .ics
              </button>
            )}
          </label>
        ))}
      </div>
      <ol className="mt-2.5 list-decimal pl-[18px] text-[13px] text-muted *:my-[3px]">
        <li>{m.howto_google()}</li>
        <li>{m.howto_outlook()}</li>
        <li>{m.howto_duplicates()}</li>
      </ol>
      <p className="mt-2 min-h-[1.4em] text-[13px] text-muted" role="status">
        {status}
      </p>
      <div className={FOOT}>
        <Button onClick={() => downloadBlob('plan.json', JSON.stringify(plan, null, 2), 'application/json')}>
          {m.download_plan_json()}
        </Button>
        <Button primary onClick={downloadZip}>
          {m.download_zip()}
        </Button>
        <Button onClick={onClose}>{m.close()}</Button>
      </div>
    </Modal>
  )
}
