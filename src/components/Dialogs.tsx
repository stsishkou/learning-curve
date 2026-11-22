import { useEffect, useRef, useState, type ReactNode } from 'react'
import { downloadBlob } from '#/lib/client'
import { fmtDay, hm, parseLocal, plural } from '#/lib/plan/dates'
import { buildICS, icsFileName, IMPORT_HOWTO } from '#/lib/plan/ics'
import type { Plan, PlanEvent } from '#/lib/plan/types'

function Modal({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dlg = ref.current
    if (!dlg) return
    if (open && !dlg.open) dlg.showModal()
    if (!open && dlg.open) dlg.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
    >
      <div className="dlg">{children}</div>
    </dialog>
  )
}

const linkify = (text: string) =>
  text.split(/(https?:\/\/\S+)/g).map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noreferrer">
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
      ? `каждый Вт и Чт ${hm(s)}–${hm(e)}, с ${fmtDay(s)}`
      : event.allDay
        ? `${fmtDay(s)}, весь день`
        : `${fmtDay(s)} ${hm(s)}–${hm(e)}`
  }
  return (
    <Modal open={!!event} onClose={onClose}>
      {event && (
        <>
          <h3>{event.title}</h3>
          <div className="meta" style={{ '--c': calendar?.color } as React.CSSProperties}>
            <i />
            {calendar?.name}, {when}
            {event.availability === 'free' ? ', не блокирует время' : ''}
          </div>
          {event.description && <pre>{linkify(event.description)}</pre>}
          <div className="foot">
            <button className="btn" type="button" onClick={onClose}>
              Закрыть
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}

export function ExportDialog({ plan, hidden, open, onClose }: { plan: Plan; hidden: ReadonlySet<string>; open: boolean; onClose: () => void }) {
  const counts = Object.fromEntries(plan.calendars.map((c) => [c.id, plan.events.filter((e) => e.calendar === c.id).length]))
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [status, setStatus] = useState('')
  useEffect(() => {
    if (open) {
      setSelected(new Set(plan.calendars.filter((c) => counts[c.id] && !hidden.has(c.id)).map((c) => c.id)))
      setStatus('')
    }
  }, [open, plan, hidden])

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  async function downloadZip() {
    const ids = plan.calendars.filter((c) => selected.has(c.id))
    if (!ids.length) return setStatus('Выберите хотя бы один календарь.')
    const { default: JSZip } = await import('jszip')
    const zip = new JSZip()
    for (const c of ids) zip.file(icsFileName(c), buildICS(c, plan.events.filter((e) => e.calendar === c.id), plan.meta.timezone))
    zip.file('Как импортировать.txt', IMPORT_HOWTO(ids.filter((c) => c.isNew).map((c) => c.name)))
    downloadBlob(`plan-ics-${plan.meta.generated}.zip`, await zip.generateAsync({ type: 'blob' }))
    setStatus(`Скачан архив: ${ids.length} ${plural(ids.length, 'календарь', 'календаря', 'календарей')}.`)
  }

  function downloadOne(id: string) {
    const c = plan.calendars.find((it) => it.id === id)!
    downloadBlob(icsFileName(c), buildICS(c, plan.events.filter((e) => e.calendar === id), plan.meta.timezone), 'text/calendar')
  }

  return (
    <Modal open={open} onClose={onClose}>
      <h3>Экспорт в календарь</h3>
      <div className="meta">Один .ics-файл на календарь. Подходит для Google Calendar и Outlook.</div>
      <div className="checks">
        {plan.calendars.map((c) => (
          <label key={c.id} style={{ '--c': c.color } as React.CSSProperties}>
            <input type="checkbox" checked={selected.has(c.id)} disabled={!counts[c.id]} onChange={() => toggle(c.id)} />
            <i />
            {c.name}
            {c.isNew && <span className="new">создать календарь</span>}
            <em>
              {counts[c.id]} {plural(counts[c.id], 'событие', 'события', 'событий')}
            </em>
            {counts[c.id] > 0 && (
              <button type="button" className="mini" onClick={(e) => (e.preventDefault(), downloadOne(c.id))}>
                .ics
              </button>
            )}
          </label>
        ))}
      </div>
      <ol className="howto">
        <li>Google Calendar: Настройки → Импорт и экспорт → выбрать .ics → выбрать календарь с тем же названием.</li>
        <li>Outlook: Добавить календарь → Загрузить из файла → выбрать .ics и календарь.</li>
        <li>Перед повторным импортом удалите старые события из этих календарей, иначе появятся дубли.</li>
      </ol>
      <p className="status" role="status">
        {status}
      </p>
      <div className="foot">
        <button className="btn" type="button" onClick={() => downloadBlob('plan.json', JSON.stringify(plan, null, 2), 'application/json')}>
          Скачать plan.json
        </button>
        <button className="btn primary" type="button" onClick={downloadZip}>
          Скачать .zip с .ics
        </button>
        <button className="btn" type="button" onClick={onClose}>
          Закрыть
        </button>
      </div>
    </Modal>
  )
}
