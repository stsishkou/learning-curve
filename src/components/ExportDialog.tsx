import { useEffect, useMemo, useState } from 'react'

import { downloadBlob, zipBlob } from '#/lib/client'
import { buildICS, icsFileName, IMPORT_HOWTO } from '#/lib/plan/ics'
import type { Plan } from '#/lib/plan/types'
import { m } from '#/paraglide/messages.js'

import { FOOT, META, Modal, TITLE } from './Modal'
import { Button, Dot, calendarColor } from './ui'

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
