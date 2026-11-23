import { fmtDay } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import { hm, parseLocal, parseQuickEvent, type Plan, type PlanEvent, type QuickEvent } from '@lc/plan-domain'
import { calendarColor, Dot, Kbd, Modal, Plus } from '@lc/ui'
import { Fragment, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'

export interface Command {
  id: string
  label: string
  /** Section heading the command is listed under */
  group: string
  /** Keys that run it without the palette, shown on the right */
  keys?: string | undefined
  run: () => void
}

interface Props {
  /** The parent owns it and sets it to false in `onClose` */
  open: boolean
  /** Its events are searched by title once two letters are typed */
  plan: Plan
  /** The actions to list, grouped by `group` in the order given: `{ id, label, group, run }` plus optional `keys` */
  commands: Command[]
  /** Called with the event picked from the search results; the palette closes itself first */
  onSelectEvent: (event: PlanEvent) => void
  /**
   * Present when events can be added: a line with a time, such as "Review tomorrow 14:00 1h", is then offered as a
   * new event, and this is called with it. `now` is the Minsk wall-clock time the words "today" and "tomorrow"
   * are read against.
   */
  onQuickAdd?: ((event: QuickEvent) => void) | undefined
  now?: number | null
  onClose: () => void
}

const MAX_EVENTS = 8

type Item = { key: string; group: string; run: () => void } & (
  | { kind: 'command'; command: Command }
  | { kind: 'event'; event: PlanEvent }
  | { kind: 'quick'; quick: QuickEvent }
)

/** Search for an event or an action and run it from the keyboard. */
export function CommandPalette({ open, plan, commands, onSelectEvent, onQuickAdd, now = null, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const listId = useId()
  const list = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (open) {
      setQuery('')
      setActive(0)
    }
  }, [open])

  const items = useMemo(() => {
    const text = query.trim().toLocaleLowerCase()
    const matches = (value: string) => value.toLocaleLowerCase().includes(text)
    const found: Item[] = commands
      .filter((c) => !text || matches(c.label) || matches(c.group))
      .map((command) => ({ kind: 'command', key: command.id, group: command.group, command, run: command.run }))
    if (text.length >= 2) {
      for (const event of plan.events) {
        if (found.length >= commands.length + MAX_EVENTS) break
        if (matches(event.title)) {
          found.push({
            kind: 'event',
            key: event.uid,
            group: m.palette_events(),
            event,
            run: () => onSelectEvent(event),
          })
        }
      }
    }
    const quick = onQuickAdd && now !== null ? parseQuickEvent(query, now) : null
    if (quick) {
      found.push({ kind: 'quick', key: 'quick-add', group: m.new_event(), quick, run: () => onQuickAdd?.(quick) })
    }
    // A typed time means a new event; then events: someone who typed a title is looking for a session, not an action.
    const rank = { quick: 0, event: 1, command: 2 }
    return found.toSorted((a, b) => rank[a.kind] - rank[b.kind])
  }, [query, commands, plan, onSelectEvent, onQuickAdd, now])

  const current = Math.min(active, Math.max(0, items.length - 1))
  useEffect(() => {
    list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [current])

  function run(item: Item | undefined) {
    if (!item) return
    onClose()
    item.run()
  }

  function keyDown(e: KeyboardEvent) {
    // Enter that confirms an IME composition must not run a command.
    if (e.nativeEvent.isComposing) return
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const step = e.key === 'ArrowDown' ? 1 : -1
      setActive((current + step + items.length) % Math.max(1, items.length))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      run(items[current])
    }
  }

  const colorOf = (id: string) => plan.calendars.find((c) => c.id === id)?.color

  return (
    <Modal open={open} top label={m.palette_title()} onClose={onClose}>
      <input
        className="w-full bg-transparent text-[17px] outline-none placeholder:text-muted"
        role="combobox"
        aria-expanded
        aria-controls={listId}
        aria-activedescendant={items[current] ? `${listId}-${items[current].key}` : undefined}
        aria-label={m.palette_title()}
        placeholder={m.palette_placeholder()}
        value={query}
        // oxlint-disable-next-line jsx-a11y/no-autofocus -- the palette is opened to type
        autoFocus
        onChange={(e) => (setQuery(e.target.value), setActive(0))}
        onKeyDown={keyDown}
      />
      <div
        ref={list}
        id={listId}
        role="listbox"
        aria-label={m.palette_title()}
        className="-mx-2 mt-3 max-h-[min(52vh,420px)] overflow-y-auto border-t border-line pt-2"
      >
        {items.map((item, i) => (
          <Fragment key={item.key}>
            {(i === 0 || items[i - 1]?.group !== item.group) && (
              <div
                role="presentation"
                className={`px-2 pb-1.5 text-[11px] font-semibold tracking-[0.08em] text-muted uppercase ${
                  i === 0 ? 'pt-1.5' : 'mt-2.5 border-t border-line-soft pt-3.5'
                }`}
              >
                {item.group}
              </div>
            )}
            {/* oxlint-disable-next-line jsx-a11y/click-events-have-key-events -- keys are handled on the input, which keeps focus */}
            <div
              id={`${listId}-${item.key}`}
              role="option"
              tabIndex={-1}
              aria-selected={i === current}
              className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-[7px] text-[14px] aria-selected:bg-surface-2"
              style={item.kind === 'event' ? calendarColor(colorOf(item.event.calendar)) : undefined}
              onPointerMove={() => setActive(i)}
              onClick={() => run(item)}
            >
              {item.kind === 'event' ? (
                <>
                  <Dot className="size-2.5" />
                  <span className={`min-w-0 flex-1 truncate ${item.event.done ? 'text-muted line-through' : ''}`}>
                    {item.event.title}
                  </span>
                  <em className="flex-none text-[12.5px] text-muted not-italic tabular-nums">
                    {fmtDay(parseLocal(item.event.start))}
                  </em>
                </>
              ) : item.kind === 'quick' ? (
                <>
                  <Plus size={15} aria-hidden className="flex-none text-focus" />
                  <span className="min-w-0 flex-1 truncate">{item.quick.title}</span>
                  <em className="flex-none text-[12.5px] text-muted not-italic tabular-nums">
                    {fmtDay(parseLocal(item.quick.start))}, {hm(parseLocal(item.quick.start))}–
                    {hm(parseLocal(item.quick.end))}
                  </em>
                </>
              ) : (
                <>
                  <span className="min-w-0 flex-1 truncate">{item.command.label}</span>
                  {item.command.keys && <Kbd>{item.command.keys}</Kbd>}
                </>
              )}
            </div>
          </Fragment>
        ))}
        {!items.length && <p className="px-2 py-6 text-center text-[13.5px] text-muted">{m.palette_empty()}</p>}
      </div>
    </Modal>
  )
}
