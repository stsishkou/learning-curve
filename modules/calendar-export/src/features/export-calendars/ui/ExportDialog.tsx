import { m } from '@lc/i18n/messages'
import {
  ALARM_MINUTES,
  calendarICS,
  combinedCalendar,
  combinedICS,
  icsFileName,
  IMPORT_HOWTO,
  planFileName,
  type Plan,
} from '@lc/plan-domain'
import { Button, calendarColor, Dot, FOOT, META, Modal, Segmented, TITLE } from '@lc/ui'
import { useEffect, useMemo, useState } from 'react'

import { downloadBlob, zipBlob } from '../../../shared/lib'

type Provider = 'google' | 'outlook' | 'apple' | 'other'
const PROVIDERS: readonly Provider[] = ['google', 'outlook', 'apple', 'other']
const PROVIDER_KEY = 'learning-curve:export-provider'
const HOWTO: Record<Provider, () => string> = {
  google: m.howto_google,
  outlook: m.howto_outlook,
  apple: m.howto_apple,
  other: m.howto_other,
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
  const countOf = (id: string) => counts[id] ?? 0
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [status, setStatus] = useState('')
  const [mode, setMode] = useState<'separate' | 'single'>('separate')
  const [provider, setProvider] = useState<Provider>('google')
  const [markDone, setMarkDone] = useState(false)
  const [alarms, setAlarms] = useState(false)
  const options = { markDone, alarm: alarms ? ALARM_MINUTES : undefined }
  useEffect(() => {
    try {
      const saved = PROVIDERS.find((p) => p === localStorage.getItem(PROVIDER_KEY))
      if (saved) setProvider(saved)
    } catch {
      // storage unavailable: the first provider stays
    }
  }, [])
  function pickProvider(next: Provider) {
    setProvider(next)
    try {
      localStorage.setItem(PROVIDER_KEY, next)
    } catch {
      // ignore
    }
  }
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

  const chosen = () => plan.calendars.filter((c) => selected.has(c.id))

  async function downloadZip() {
    const calendars = chosen()
    if (!calendars.length) return setStatus(m.export_select_calendar())
    const files: Record<string, string> = {
      'Как импортировать.txt': IMPORT_HOWTO(calendars.filter((c) => c.isNew).map((c) => c.name)),
    }
    for (const c of calendars) files[icsFileName(c)] = calendarICS(plan, c, options)
    downloadBlob(`plan-ics-${plan.meta.generated}.zip`, await zipBlob(files))
    setStatus(m.export_done({ count: calendars.length }))
  }

  function downloadCombined() {
    const calendars = chosen()
    if (!calendars.length) return setStatus(m.export_select_calendar())
    const name = icsFileName(combinedCalendar(plan))
    downloadBlob(name, combinedICS(plan, new Set(calendars.map((c) => c.id)), options), 'text/calendar')
    setStatus(m.export_done_single({ name }))
  }

  function downloadOne(id: string) {
    const c = plan.calendars.find((it) => it.id === id)!
    downloadBlob(icsFileName(c), calendarICS(plan, c, options), 'text/calendar')
  }

  return (
    <Modal open={open} onClose={onClose}>
      <h3 className={TITLE}>{m.export_to_calendar()}</h3>
      <div className={META}>{mode === 'separate' ? m.export_hint() : m.export_hint_single()}</div>
      <div className="mt-3">
        <Segmented
          label={m.export_mode()}
          value={mode}
          options={[
            { value: 'separate', label: m.export_separate() },
            { value: 'single', label: m.export_single() },
          ]}
          onChange={(next) => (setMode(next), setStatus(''))}
        />
      </div>
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
            <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2.5 gap-y-0.5">
              {c.name}
              {mode === 'separate' && c.isNew && (
                <span className="rounded-md border border-current px-[5px] text-[11.5px] whitespace-nowrap text-focus">
                  {m.create_calendar()}
                </span>
              )}
            </span>
            <em className="text-[13px] whitespace-nowrap text-muted not-italic tabular-nums">
              {m.events_count({ count: countOf(c.id) })}
            </em>
            {mode === 'separate' && countOf(c.id) > 0 && (
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
      <label className="flex items-center gap-2.5 px-2 py-[7px] text-[13.5px]">
        <input type="checkbox" checked={markDone} onChange={(e) => setMarkDone(e.target.checked)} />
        {m.export_mark_done()}
      </label>
      <label className="flex items-center gap-2.5 px-2 py-[7px] text-[13.5px]">
        <input type="checkbox" checked={alarms} onChange={(e) => setAlarms(e.target.checked)} />
        {m.export_alarms({ minutes: ALARM_MINUTES })}
      </label>
      {alarms && provider === 'google' && (
        <p className="px-2 pb-1 text-[12.5px] text-muted">{m.export_alarms_google()}</p>
      )}
      <div className="mt-2.5 text-[13px]">
        <Segmented
          label={m.export_where()}
          value={provider}
          options={[
            { value: 'google', label: m.provider_google() },
            { value: 'outlook', label: m.provider_outlook() },
            { value: 'apple', label: m.provider_apple() },
            { value: 'other', label: m.provider_other() },
          ]}
          onChange={pickProvider}
        />
      </div>
      <ol className="mt-2.5 list-decimal pl-[18px] text-[13px] text-muted *:my-[3px]">
        {mode === 'separate' && <li>{m.howto_unzip()}</li>}
        {mode === 'separate' && chosen().some((c) => c.isNew) && <li>{m.howto_create_first()}</li>}
        <li>{HOWTO[provider]()}</li>
        {mode === 'single' && <li>{m.howto_single()}</li>}
        <li>{m.howto_duplicates()}</li>
      </ol>
      <p className="mt-2 min-h-[1.4em] text-[13px] text-muted" role="status">
        {status}
      </p>
      <div className={FOOT}>
        <Button onClick={() => downloadBlob(planFileName(plan), JSON.stringify(plan, null, 2), 'application/json')}>
          {m.download_plan_json()}
        </Button>
        {mode === 'separate' ? (
          <Button primary onClick={downloadZip}>
            {m.download_zip()}
          </Button>
        ) : (
          <Button primary onClick={downloadCombined}>
            {m.download_ics()}
          </Button>
        )}
        <Button onClick={onClose}>{m.close()}</Button>
      </div>
    </Modal>
  )
}
