import { fmtDay } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import {
  DAY,
  hm,
  isCustomEvent,
  isSession,
  nextFreeSlot,
  nowMinsk,
  overlapping,
  parseLocal,
  skipDay,
  splitInHalves,
  toLocalString,
  type BusyBlock,
  type NewEvent,
  type Plan,
  type PlanChange,
  type PlanEvent,
} from '@lc/plan-domain'
import {
  Button,
  CalendarPlus,
  calendarColor,
  CalendarSearch,
  Check,
  Copy,
  Dot,
  ExternalLink,
  FOOT,
  HEAD,
  Link2,
  Maximize2,
  META,
  Minimize2,
  Modal,
  Scissors,
  Timer,
  TITLE,
  Trash2,
  X,
} from '@lc/ui'
import { useState } from 'react'

import { useEventExpanded } from '../model/use-event-expanded'
import { EventForm } from './EventForm'
import { EventNudge } from './EventNudge'
import { OverlapNote, type Overlap } from './OverlapNote'
import { SpentTime } from './SpentTime'

const URL_PATTERN = /(https?:\/\/\S+)/g

const linkify = (text: string) =>
  text.split(URL_PATTERN).map((part, i) =>
    /^https?:\/\//.test(part) ? (
      // oxlint-disable-next-line react/no-array-index-key -- the parts of one description never reorder
      <a key={i} className="text-focus underline" href={part} target="_blank" rel="noreferrer">
        {part}
      </a>
    ) : (
      part
    ),
  )

const NO_BUSY: BusyBlock[] = []

const BIG_TITLE = 'mb-1 text-[22px]/[1.3] font-semibold'

const HEAD_BUTTON =
  'grid size-8 place-items-center rounded-lg text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-ink'

const stamp = (local: string) => `${local.replaceAll(/[-:]/g, '')}00`

/** The page of Google Calendar that creates this event, filled in: nothing is sent until it is saved there. */
function googleLink(event: PlanEvent, zone: string): string {
  const query = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${stamp(event.start)}/${stamp(event.end)}`,
    ctz: zone,
    details: event.description,
  })
  return `https://calendar.google.com/calendar/render?${query.toString()}`
}

function eventLink(uid: string): string {
  const url = new URL(location.href)
  url.searchParams.set('event', uid)
  return url.toString()
}

interface Props {
  /** The whole plan, hidden calendars included: a free slot and the overlap warning count their sessions too */
  plan: Plan
  /** The event to show; null with no `draft` keeps the dialog closed */
  event: PlanEvent | null
  /** For a repeating event: the day of the repeat that was opened, `YYYY-MM-DD` */
  day?: string | null
  /** Called when the opened repeat is moved to another day */
  onDayChange?: (day: string) => void
  /** A new event to create: the dialog opens as a form filled with these values */
  draft: NewEvent | null
  /** true when the event already differs from the generated schedule */
  edited: boolean
  /** false hides every control that changes the plan */
  canEdit: boolean
  /** Stores one change. Rejects with the reason when it cannot be stored: the dialog shows it */
  onChange: (change: PlanChange) => Promise<void>
  onClose: () => void
  /** Called with the fields of the new event while its form is filled in */
  onDraftChange?: (draft: NewEvent) => void
  /** Busy time of the person's own calendar around the event: the overlap warning names it too */
  busy?: BusyBlock[]
  /** Returns the element that shows the event on the page: the dialog opens beside it */
  anchor?: () => Element | null
  /** Present when there is a focus page: called with the uid of a session not done, to time it there */
  onFocus?: ((uid: string) => void) | undefined
}

/**
 * One event: what it is, and for an editable plan every way to change it. It is open while it has an `event` or a
 * `draft`; with a `draft` it starts as the form for a new event. Each button sends one `PlanChange` through
 * `onChange`.
 */
export function EventDialog({
  plan,
  event,
  day = null,
  onDayChange,
  draft,
  edited,
  canEdit,
  onChange,
  onClose,
  onDraftChange,
  busy: taken = NO_BUSY,
  anchor,
  onFocus,
}: Props) {
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [free, setFree] = useState<{ uid: string; slot: { s: number; e: number } | null } | null>(null)
  const [linked, setLinked] = useState(false)
  /** The session whose Mark done asks for its time */
  const [finishing, setFinishing] = useState<string | null>(null)
  const { available: expandable, expanded, toggle: toggleExpanded } = useEventExpanded()
  // A new event's form stays beside its draft, which shows the event on the page while it is filled in.
  const big = expanded && event !== null
  const close = () => {
    setEditing(false)
    setError('')
    setFree(null)
    setLinked(false)
    setFinishing(null)
    onClose()
  }

  async function run(change: PlanChange, then: 'stay' | 'close' = 'stay') {
    setBusy(true)
    setError('')
    try {
      await onChange(change)
      setEditing(false)
      setFree(null)
      setFinishing(null)
      if (then === 'close') close()
    } catch (err) {
      setError(m.save_failed({ reason: err instanceof Error ? err.message : String(err) }))
    } finally {
      setBusy(false)
    }
  }

  /** Adds a session of the same module in the next free slot after this one, for the part it did not get to. */
  function continueLater(session: PlanEvent) {
    const s = parseLocal(session.start)
    const e = parseLocal(session.end)
    const slot = nextFreeSlot(plan, {
      from: Math.max(nowMinsk(), e),
      length: e - s,
      preferHour: new Date(s).getUTCHours(),
      busy: taken,
    })
    if (!slot) {
      setError(m.free_slot_none())
      return
    }
    void run(
      {
        type: 'event.add',
        event: {
          calendar: session.calendar,
          title: session.title,
          description: session.description,
          availability: session.availability,
          ...(session.kind === 'lab' ? { kind: 'lab' as const } : {}),
          start: toLocalString(slot.s),
          end: toLocalString(slot.e),
        },
      },
      'close',
    )
  }

  async function copyLink(uid: string) {
    try {
      await navigator.clipboard.writeText(eventLink(uid))
      setLinked(true)
    } catch {
      setLinked(false)
    }
  }

  // An offer made for another event is not shown on this one.
  const offer = free && free.uid === event?.uid ? free : null
  const asking = event !== null && !event.done && isSession(event) && finishing === event.uid
  const calendar = plan.calendars.find((c) => c.id === event?.calendar)
  // A hidden calendar stays offered to the event already in it, so its form keeps a value.
  const offered = plan.calendars.filter((c) => !c.hidden || c.id === event?.calendar)
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
  const courseUrl = event?.description.match(URL_PATTERN)?.[0]
  const halves = event ? splitInHalves(event) : null
  const overlaps = (start: string, end: string): Overlap[] => {
    const slot = { s: parseLocal(start), e: parseLocal(end) }
    return [
      ...overlapping(plan, slot, event?.uid),
      ...taken
        .filter((b) => !b.allDay && b.s < slot.e && slot.s < b.e)
        .map((b) => ({ title: b.title || m.busy_block(), s: b.s, e: b.e })),
    ]
  }
  // Of a repeating event, the repeat that was opened.
  const shownDay = event && (event.rrule && day ? day : event.start.slice(0, 10))
  const ownOverlaps =
    event && shownDay && !event.allDay && event.availability !== 'free'
      ? overlaps(`${shownDay}T${event.start.slice(11, 16)}`, `${shownDay}T${event.end.slice(11, 16)}`)
      : []

  return (
    <Modal
      open={Boolean(event) || Boolean(draft)}
      anchor={big ? undefined : anchor}
      size={big ? 'wide' : 'normal'}
      onClose={close}
    >
      {draft && !event && (
        <EventForm
          // A fresh form per slot, so fields never carry over from the previous one.
          key={draft.start}
          heading={m.new_event()}
          initial={draft}
          calendars={offered}
          chooseAvailability
          overlaps={overlaps}
          busy={busy}
          error={error}
          onCancel={close}
          onSubmit={(values) => void run({ type: 'event.add', event: values }, 'close')}
          onProblem={setError}
          onValues={onDraftChange}
        />
      )}
      {event && editing && (
        <EventForm
          key={event.uid}
          heading={m.edit()}
          expanded={big}
          initial={{ ...event }}
          calendars={offered}
          allDay={event.allDay}
          recurring={Boolean(event.rrule)}
          overlaps={event.availability === 'free' ? undefined : overlaps}
          busy={busy}
          error={error}
          onCancel={() => {
            setEditing(false)
            setError('')
          }}
          onSubmit={({ availability: _unchanged, ...patch }) =>
            void run({ type: 'event.patch', uid: event.uid, patch })
          }
          onProblem={setError}
        />
      )}
      {event && !editing && (
        <>
          <div className={`flex items-start gap-3 ${big ? HEAD : ''}`}>
            <h3
              className={`${big ? BIG_TITLE : TITLE} min-w-0 flex-1 ${event.done ? `text-muted line-through ${event.skipped ? 'decoration-today' : 'decoration-done'}` : ''}`}
            >
              {event.title}
            </h3>
            <span className="-mt-1 -mr-1.5 flex shrink-0 gap-0.5">
              {expandable && (
                <button
                  type="button"
                  className={HEAD_BUTTON}
                  aria-pressed={big}
                  aria-label={m.expand()}
                  data-tip={m.event_expand_hint()}
                  onClick={toggleExpanded}
                >
                  {big ? <Minimize2 size={18} aria-hidden /> : <Maximize2 size={18} aria-hidden />}
                </button>
              )}
              <button
                type="button"
                className={HEAD_BUTTON}
                aria-label={m.close()}
                data-tip={m.close()}
                // Not Expand, which comes first: a stray Enter would change how every later event opens.
                data-autofocus
                onClick={close}
              >
                <X size={18} aria-hidden />
              </button>
            </span>
          </div>
          <div className={META} style={calendarColor(calendar?.color)}>
            <Dot className="size-2.5" />
            {calendar?.name}, {when}
            {event.availability === 'free' ? `, ${m.event_free()}` : ''}
            {event.done && (
              <span className="rounded-md border border-current px-[5px] text-[11.5px] text-done-ink">{m.done()}</span>
            )}
            {edited && (
              <span className="rounded-md border border-current px-[5px] text-[11.5px] text-focus">
                {isCustomEvent(event) ? m.event_added() : m.event_edited()}
              </span>
            )}
          </div>
          {ownOverlaps.length > 0 && (
            <div className="mt-2.5">
              <OverlapNote overlaps={ownOverlaps} />
            </div>
          )}
          {event.description && (
            <pre
              className={`mt-3.5 rounded-[10px] bg-surface-2 px-3.5 py-3 font-sans ${big ? 'max-w-[75ch] text-[15.5px]/[1.6]' : 'text-[14px]/[1.55]'} wrap-anywhere whitespace-pre-wrap`}
            >
              {linkify(event.description)}
            </pre>
          )}
          {canEdit && (
            <EventNudge
              event={event}
              day={day}
              disabled={busy}
              onMove={(patch, landed) => {
                onDayChange?.(landed)
                void run({ type: 'event.patch', uid: event.uid, patch })
              }}
            />
          )}
          {canEdit && event.done && isSession(event) && (
            <>
              <SpentTime
                event={event}
                spent={event.actual}
                disabled={busy}
                onLog={(actual) => void run({ type: 'event.patch', uid: event.uid, patch: { actual } })}
              />
              <label className="mt-2.5 flex items-center gap-2 text-[13px]">
                <input
                  type="checkbox"
                  checked={Boolean(event.unfinished)}
                  disabled={busy}
                  onChange={(e) =>
                    void run({ type: 'event.patch', uid: event.uid, patch: { unfinished: e.target.checked } })
                  }
                />
                {m.unfinished_label()}
              </label>
              {event.unfinished && (
                <Button className="mt-2 px-2.5 py-1 text-[13px]" disabled={busy} onClick={() => continueLater(event)}>
                  {m.unfinished_add()}
                </Button>
              )}
            </>
          )}
          {canEdit && asking && (
            <>
              <SpentTime
                event={event}
                spent={undefined}
                asking
                disabled={busy}
                onLog={(actual) => void run({ type: 'event.patch', uid: event.uid, patch: { done: true, actual } })}
              />
              <div className="mt-2.5 flex flex-wrap gap-2">
                <Button
                  className="px-2.5 py-1 text-[13px]"
                  disabled={busy}
                  onClick={() => void run({ type: 'event.patch', uid: event.uid, patch: { done: true } })}
                >
                  {m.spent_done_without()}
                </Button>
                <Button className="px-2.5 py-1 text-[13px]" disabled={busy} onClick={() => setFinishing(null)}>
                  {m.cancel()}
                </Button>
              </div>
            </>
          )}
          {offer && (
            <p className="mt-3 flex flex-wrap items-center gap-2 text-[13.5px]" role="status">
              {offer.slot ? (
                <>
                  {m.free_slot_offer({ when: `${fmtDay(offer.slot.s)} ${hm(offer.slot.s)}–${hm(offer.slot.e)}` })}
                  <Button
                    className="px-2.5 py-1 text-[13px]"
                    disabled={busy}
                    onClick={() =>
                      offer.slot &&
                      void run({
                        type: 'event.patch',
                        uid: event.uid,
                        patch: { start: toLocalString(offer.slot.s), end: toLocalString(offer.slot.e) },
                      })
                    }
                  >
                    {m.free_slot_move()}
                  </Button>
                </>
              ) : (
                m.free_slot_none()
              )}
            </p>
          )}
          {error && (
            <p className="mt-2 text-[13px] text-today-ink" role="alert">
              {error}
            </p>
          )}
          <div className={FOOT}>
            <span className="mr-auto flex flex-wrap gap-2">
              {canEdit && (
                <Button
                  className="grid place-items-center px-2.5 text-today-ink"
                  disabled={busy}
                  aria-label={event.rrule ? m.delete_series() : m.delete_event()}
                  data-tip={`${event.rrule ? m.delete_series() : m.delete_event()}. ${m.delete_event_hint()}`}
                  onClick={() => void run({ type: 'event.remove', uid: event.uid }, 'close')}
                >
                  <Trash2 size={16} aria-hidden />
                </Button>
              )}
              {canEdit && event.rrule && day && (
                <Button disabled={busy} onClick={() => void run(skipDay(event, day), 'close')}>
                  {m.skip_day({ date: fmtDay(parseLocal(day)) })}
                </Button>
              )}
              {canEdit && edited && !isCustomEvent(event) && (
                <Button disabled={busy} onClick={() => void run({ type: 'event.patch', uid: event.uid, patch: null })}>
                  {m.reset_event()}
                </Button>
              )}
              {canEdit && !event.rrule && !event.allDay && (
                <Button
                  className="grid place-items-center px-2.5"
                  disabled={busy}
                  aria-label={m.duplicate()}
                  data-tip={m.duplicate()}
                  onClick={() =>
                    void run(
                      {
                        type: 'event.add',
                        event: {
                          calendar: event.calendar,
                          title: event.title,
                          description: event.description,
                          availability: event.availability,
                          start: toLocalString(parseLocal(event.start) + DAY),
                          end: toLocalString(parseLocal(event.end) + DAY),
                        },
                      },
                      'close',
                    )
                  }
                >
                  <Copy size={16} aria-hidden />
                </Button>
              )}
              {canEdit && halves && (
                <Button
                  className="grid place-items-center px-2.5"
                  disabled={busy}
                  aria-label={m.split_in_two()}
                  data-tip={`${m.split_in_two()}. ${m.split_hint()}`}
                  onClick={() => void run(halves, 'close')}
                >
                  <Scissors size={16} aria-hidden />
                </Button>
              )}
              {onFocus && isSession(event) && !event.done && (
                <Button
                  className="grid place-items-center px-2.5 text-focus"
                  aria-label={m.focus_start_this()}
                  data-tip={m.focus_start_this()}
                  onClick={() => onFocus(event.uid)}
                >
                  <Timer size={16} aria-hidden />
                </Button>
              )}
              {canEdit && isSession(event) && !event.done && (
                <Button
                  className="grid place-items-center px-2.5"
                  disabled={busy}
                  aria-label={m.free_slot_find()}
                  data-tip={`${m.free_slot_find()}. ${m.free_slot_hint()}`}
                  onClick={() => {
                    const s = parseLocal(event.start)
                    const e = parseLocal(event.end)
                    setFree({
                      uid: event.uid,
                      slot: nextFreeSlot(plan, {
                        from: nowMinsk(),
                        length: e - s,
                        preferHour: new Date(s).getUTCHours(),
                        except: { uid: event.uid, s, e, study: event.calendar !== 'personal' },
                        busy: taken,
                      }),
                    })
                  }}
                >
                  <CalendarSearch size={16} aria-hidden />
                </Button>
              )}
              <Button
                className={`grid place-items-center px-2.5 ${linked ? 'text-done-ink' : ''}`}
                aria-label={m.copy_link()}
                data-tip={linked ? m.copied() : m.copy_link()}
                onClick={() => void copyLink(event.uid)}
              >
                {linked ? <Check size={16} aria-hidden /> : <Link2 size={16} aria-hidden />}
              </Button>
              {!event.rrule && !event.allDay && (
                <a
                  className="grid place-items-center rounded-[10px] border border-line bg-surface px-2.5 shadow-card transition-colors duration-150 hover:bg-surface-2"
                  href={googleLink(event, plan.meta.timezone)}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={m.add_to_google()}
                  data-tip={m.add_to_google()}
                >
                  <CalendarPlus size={16} aria-hidden />
                </a>
              )}
              {courseUrl && (
                <a
                  className="flex items-center gap-1.5 rounded-[10px] border border-line bg-surface px-3.5 py-2 font-medium shadow-card transition-colors duration-150 hover:bg-surface-2"
                  href={courseUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {m.open_course()} <ExternalLink size={14} aria-hidden />
                </a>
              )}
            </span>
            {canEdit && isSession(event) && !event.done && !asking && (
              <Button
                disabled={busy}
                data-tip={m.skip_session_hint()}
                onClick={() => void run({ type: 'event.patch', uid: event.uid, patch: { done: true, skipped: true } })}
              >
                {m.skip_session()}
              </Button>
            )}
            {canEdit && isSession(event) && !asking && (
              <Button
                className={`flex items-center gap-1.5 ${event.done ? '' : 'border-done text-done-ink'}`}
                disabled={busy}
                icon={event.done ? undefined : <Check size={15} aria-hidden />}
                label={event.skipped ? m.unskip_session() : event.done ? m.mark_not_done() : m.mark_done()}
                onClick={() =>
                  event.done
                    ? void run({ type: 'event.patch', uid: event.uid, patch: { done: false } })
                    : setFinishing(event.uid)
                }
              />
            )}
            {canEdit && (
              <Button primary onClick={() => setEditing(true)}>
                {m.edit()}
              </Button>
            )}
          </div>
        </>
      )}
    </Modal>
  )
}
