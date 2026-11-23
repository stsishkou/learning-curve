import { fmtDuration, fmtShift, fmtZoneRegion } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import { hm, zoneShift } from '@lc/plan-domain'
import { Button, Check, FOOT, INPUT, META, Modal, TITLE } from '@lc/ui'
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'

import { cityOf, findZones, listZones } from '../model/zones'

interface Props {
  open: boolean
  /** The zone chosen now, an IANA name such as `Europe/Warsaw`; null for none */
  zone: string | null
  /** Minsk wall-clock ms: the clocks in the list show this moment. null before the clock is known */
  now: number | null
  /** Called with the new choice; the dialog stays open, so the hour column can be seen changing */
  onChoose: (zone: string | null) => void
  onClose: () => void
}

const here = () => Intl.DateTimeFormat().resolvedOptions().timeZone

/** `2 h behind the plan`, `5 h 30 min ahead of the plan`, `the same time as the plan` */
const shiftWords = (shift: number) =>
  shift === 0
    ? m.zone_same()
    : shift > 0
      ? m.zone_ahead({ time: fmtDuration(shift) })
      : m.zone_behind({ time: fmtDuration(-shift) })

/**
 * Picks the time zone whose clock is shown next to the plan's own in the hour column. Zones are found by typing
 * a city, a country or an offset; each is listed with the time there now and how far that is from the plan.
 */
export function SecondZoneDialog({ open, zone, now, onChoose, onClose }: Props) {
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

  // Per minute, not per tick of the clock: the list is some four hundred zones.
  const minute = now === null ? null : now - (now % 60_000)
  const zones = useMemo(() => (open && minute !== null ? listZones(minute, fmtZoneRegion) : []), [open, minute])
  const found = useMemo(() => (open ? findZones(zones, query, here()) : []), [open, zones, query])
  const current = Math.min(active, Math.max(0, found.length - 1))
  const chosenShift = zone && now !== null ? zoneShift(zone, now) : null

  useEffect(() => {
    list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [current])

  function keyDown(e: KeyboardEvent) {
    if (e.nativeEvent.isComposing) return
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const step = e.key === 'ArrowDown' ? 1 : -1
      setActive((current + step + found.length) % Math.max(1, found.length))
    } else if (e.key === 'Enter' && found[current]) {
      e.preventDefault()
      onChoose(found[current].id)
    }
  }

  return (
    <Modal open={open} onClose={onClose}>
      <h2 className={TITLE}>{m.second_zone()}</h2>
      <p className={META}>{m.second_zone_hint()}</p>

      {now !== null && (
        <dl className="mt-3.5 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-surface-2 px-3 py-2.5">
            <dt className="text-[12px] text-muted">{m.zone_plan_clock({ city: m.plan_zone() })}</dt>
            <dd className="font-display text-[22px]/[1.3] font-semibold tabular-nums">{hm(now)}</dd>
          </div>
          <div className="rounded-xl bg-surface-2 px-3 py-2.5">
            <dt className="truncate text-[12px] text-muted">
              {zone ? m.zone_second_clock({ city: cityOf(zone) }) : m.zone_second_none()}
            </dt>
            <dd className="font-display text-[22px]/[1.3] font-semibold tabular-nums">
              {chosenShift === null ? '—' : hm(now + chosenShift)}
              {chosenShift !== null && (
                <small className="ml-2 font-sans text-[12.5px] font-normal text-muted">{shiftWords(chosenShift)}</small>
              )}
            </dd>
          </div>
        </dl>
      )}
      {now !== null && chosenShift !== null && zone && (
        <p className="mt-2 text-[13px] text-muted">
          {m.zone_example({ plan: '12:00', there: hm(12 * 3_600_000 + chosenShift), city: cityOf(zone) })}
        </p>
      )}

      {open && (
        <>
          <input
            className={`${INPUT} mt-4`}
            role="combobox"
            aria-expanded
            aria-controls={listId}
            aria-activedescendant={found[current] ? `${listId}-${found[current].id}` : undefined}
            aria-label={m.zone_search()}
            placeholder={m.zone_search()}
            value={query}
            autoComplete="off"
            spellCheck={false}
            // oxlint-disable-next-line jsx-a11y/no-autofocus -- the dialog is opened to find a zone
            autoFocus
            onChange={(e) => (setQuery(e.target.value), setActive(0))}
            onKeyDown={keyDown}
          />
          <div
            ref={list}
            id={listId}
            role="listbox"
            aria-label={m.second_zone()}
            className="-mx-2 mt-2 h-[min(40vh,300px)] overflow-y-auto"
          >
            {found.map((option, i) => (
              // oxlint-disable-next-line jsx-a11y/click-events-have-key-events -- keys are handled on the input, which keeps focus
              <div
                key={option.id}
                id={`${listId}-${option.id}`}
                role="option"
                tabIndex={-1}
                aria-selected={i === current}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-[7px] text-[14px] aria-selected:bg-surface-2"
                onPointerMove={() => setActive(i)}
                onClick={() => onChoose(option.id)}
              >
                <Check
                  size={15}
                  aria-hidden
                  className={`flex-none text-focus ${option.id === zone ? '' : 'invisible'}`}
                />
                <span className="min-w-0 flex-1 truncate">
                  <b className="font-medium">{option.city}</b>
                  <span className="ml-2 text-[12.5px] text-muted">
                    {option.id === here() ? `${m.zone_mine()} · ` : ''}
                    {fmtZoneRegion(option.id) || option.id}
                  </span>
                </span>
                {now !== null && (
                  <em className="flex-none text-[13px] not-italic tabular-nums">
                    {hm(now + option.shift)}
                    <span className="ml-2 inline-block w-[52px] text-right text-[12.5px] text-muted">
                      {fmtShift(option.shift) || '='}
                    </span>
                  </em>
                )}
              </div>
            ))}
            {!found.length && <p className="px-2 py-6 text-center text-[13.5px] text-muted">{m.zone_not_found()}</p>}
          </div>
        </>
      )}

      <div className={FOOT}>
        {zone && (
          <Button className="mr-auto" onClick={() => onChoose(null)}>
            {m.second_zone_none()}
          </Button>
        )}
        <Button primary onClick={onClose}>
          {m.close()}
        </Button>
      </div>
    </Modal>
  )
}
