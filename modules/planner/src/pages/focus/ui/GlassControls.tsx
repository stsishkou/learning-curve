import { m } from '@lc/i18n/messages'
import { Button, Hourglass, INPUT, Segmented } from '@lc/ui'
import { useId, useState, type KeyboardEvent } from 'react'

import { clampMinutes, REST_MINUTES, WORK_MINUTES, type GlassMode, type GlassSettings } from '../model/blocks'

interface Props {
  settings: GlassSettings
  /** On one line, as far as the width allows: Expand leaves the height to the watch */
  compact?: boolean | undefined
  onChoose: (mode: GlassMode) => void
  onMinutes: (part: { work?: number; rest?: number }) => void
  onToggleStill: () => void
  onToggleHidden: () => void
}

/** What the hourglass holds, how it moves, and whether it is shown. */
export function GlassControls(props: Props) {
  const { settings, compact = false, onChoose, onMinutes, onToggleStill, onToggleHidden } = props
  const ids = useId()
  const modes: { value: GlassMode; label: string }[] = [
    { value: 'session', label: m.focus_glass_session() },
    { value: 'short', label: m.focus_breaks_short() },
    { value: 'long', label: m.focus_breaks_long() },
    { value: 'custom', label: m.focus_glass_custom() },
  ]
  return (
    <div
      className={`text-[13px] ${compact ? 'flex flex-wrap items-center justify-center gap-x-4 gap-y-2' : 'grid justify-items-center gap-2'}`}
    >
      <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1.5">
        <span className="text-muted" aria-hidden>
          {m.focus_glass()}
        </span>
        <Segmented label={m.focus_glass()} value={settings.mode} options={modes} onChange={onChoose} />
      </div>
      {settings.mode === 'custom' && (
        // Stored when a field is left or Enter is pressed: a half-typed number would end the block at once.
        <CustomMinutes settings={settings} onMinutes={onMinutes} />
      )}
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5">
        {!settings.hidden && (
          <span className="flex items-center gap-1.5 text-muted" data-tip={m.focus_glass_still_hint()}>
            <input
              id={`${ids}-still`}
              type="checkbox"
              className="size-3.5 accent-ink"
              checked={settings.still}
              onChange={onToggleStill}
            />
            <label htmlFor={`${ids}-still`}>{m.focus_glass_still()}</label>
          </span>
        )}
        <Button
          className="flex items-center gap-1.5 px-2.5 py-1! text-[13px]"
          icon={<Hourglass size={15} aria-hidden />}
          label={settings.hidden ? m.focus_glass_show() : m.focus_glass_hide()}
          onClick={onToggleHidden}
        />
      </div>
    </div>
  )
}

/** The typed minutes within their range; null when nothing readable was typed */
const minutesIn = (text: string, range: { min: number; max: number }) =>
  text.trim() && Number.isFinite(Number(text)) ? clampMinutes(Number(text), range) : null

function CustomMinutes({ settings, onMinutes }: { settings: GlassSettings; onMinutes: Props['onMinutes'] }) {
  const ids = useId()
  const [work, setWork] = useState(String(settings.work))
  const [rest, setRest] = useState(String(settings.rest))
  const store = () => {
    const next = {
      work: minutesIn(work, WORK_MINUTES) ?? settings.work,
      rest: minutesIn(rest, REST_MINUTES) ?? settings.rest,
    }
    setWork(String(next.work))
    setRest(String(next.rest))
    if (next.work !== settings.work || next.rest !== settings.rest) onMinutes(next)
  }
  const enter = (e: KeyboardEvent) => {
    if (e.key === 'Enter') store()
  }
  const field = `${INPUT} w-[4.5rem] py-1 text-center text-[14px] tabular-nums`
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5">
      <span className="flex items-center gap-1.5">
        <label className="text-muted" htmlFor={`${ids}-work`}>
          {m.focus_glass_work()}
        </label>
        <input
          id={`${ids}-work`}
          className={field}
          type="number"
          inputMode="numeric"
          min={WORK_MINUTES.min}
          max={WORK_MINUTES.max}
          value={work}
          onChange={(e) => setWork(e.target.value)}
          onBlur={store}
          onKeyDown={enter}
        />
      </span>
      <span className="flex items-center gap-1.5">
        <label className="text-muted" htmlFor={`${ids}-rest`}>
          {m.focus_glass_rest()}
        </label>
        <input
          id={`${ids}-rest`}
          className={field}
          type="number"
          inputMode="numeric"
          min={REST_MINUTES.min}
          max={REST_MINUTES.max}
          value={rest}
          onChange={(e) => setRest(e.target.value)}
          onBlur={store}
          onKeyDown={enter}
        />
      </span>
    </div>
  )
}
