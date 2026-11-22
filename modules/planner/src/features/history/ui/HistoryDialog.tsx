import { fmtDay } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import { hm, startOfDay, toMinsk, type HistoryView } from '@lc/plan-domain'
import { Button, FOOT, Kbd, META, Modal, TITLE } from '@lc/ui'
import { useState } from 'react'

import { describeStep } from '../model/describe-step'

interface Props {
  /** The parent owns it and sets it to false in `onClose` */
  open: boolean
  /** The stored steps, oldest first, and `cursor`: how many of them are applied now */
  history: HistoryView
  /** `⌘` or `Ctrl`, for the shortcut hints */
  mod: string
  /** Wall-clock ms, to leave the date out for today's steps; null before the clock is known */
  now: number | null
  /** Rejects with the reason when the plan cannot be moved there */
  onTravel: (cursor: number) => Promise<void>
  onClose: () => void
}

const SIGN: Record<string, string> = {
  'event.add': '＋',
  'event.remove': '−',
  'calendar.remove': '−',
  'calendar.clear': '−',
  'trash.empty': '−',
  'trash.restore': '↺',
}

/** Every change as a timeline: pick a point to move the plan there, back or forward. */
export function HistoryDialog({ open, history, mod, now, onTravel, onClose }: Props) {
  const [error, setError] = useState('')
  const { steps, cursor } = history

  async function go(to: number) {
    try {
      await onTravel(to)
      setError('')
    } catch (err) {
      setError(m.save_failed({ reason: err instanceof Error ? err.message : String(err) }))
    }
  }

  const point = (to: number, sign: string, label: string, time: string) => {
    const current = to === cursor
    const undone = to > cursor
    return (
      <li key={to}>
        <button
          type="button"
          className={`grid w-full grid-cols-[22px_1fr_auto] items-baseline gap-x-2.5 rounded-xl border px-3 py-2 text-left text-[13.5px] ${
            current
              ? 'border-focus bg-[color-mix(in_srgb,var(--focus)_10%,var(--surface))]'
              : 'border-transparent hover:bg-surface-2'
          } ${undone ? 'text-muted' : ''}`}
          aria-current={current ? 'step' : undefined}
          onClick={() => void go(to)}
        >
          <span aria-hidden className={`text-center ${current ? 'text-focus' : 'text-muted'}`}>
            {current ? '●' : sign}
          </span>
          <span className={`min-w-0 truncate ${undone ? 'line-through decoration-line' : ''}`}>{label}</span>
          <span className="text-[12.5px] text-muted tabular-nums">
            {current ? m.history_here() : undone ? m.history_undone() : time}
          </span>
        </button>
      </li>
    )
  }

  return (
    <Modal open={open} onClose={onClose}>
      <h3 className={TITLE}>{m.history()}</h3>
      <div className={META}>{m.history_hint()}</div>

      {steps.length === 0 ? (
        <p className="mt-6 mb-2 text-center text-[14px] text-muted">{m.history_empty()}</p>
      ) : (
        <ol className="mt-3.5 grid grid-cols-[minmax(0,1fr)] gap-0.5">
          {steps
            .map((step, i) => {
              const at = toMinsk(Date.parse(step.at))
              const today = now !== null && startOfDay(at) === startOfDay(now)
              return point(i + 1, SIGN[step.change.type] ?? '✎', describeStep(step), today ? hm(at) : fmtDay(at))
            })
            .toReversed()}
          {point(0, '○', m.history_start(), '')}
        </ol>
      )}

      {error && (
        <p className="mt-2 text-[13px] text-today-ink" role="alert">
          {error}
        </p>
      )}
      <div className={FOOT}>
        <span className="mr-auto flex flex-wrap gap-2">
          <Button disabled={cursor === 0} onClick={() => void go(cursor - 1)}>
            ↶ {m.undo()} <Kbd>{mod} Z</Kbd>
          </Button>
          <Button disabled={cursor >= steps.length} onClick={() => void go(cursor + 1)}>
            ↷ {m.redo()} <Kbd>{mod} ⇧ Z</Kbd>
          </Button>
        </span>
        <Button onClick={onClose}>{m.close()}</Button>
      </div>
    </Modal>
  )
}
