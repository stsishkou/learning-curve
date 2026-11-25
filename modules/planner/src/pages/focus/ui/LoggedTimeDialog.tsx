import { fmtDuration } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import { Button, FIELD, FOOT, INPUT, META, Modal, TITLE } from '@lc/ui'
import { useState } from 'react'

import { TimeChoices } from '../../../shared/ui'
import type { LongRun } from '../model/finish'

const MINUTE = 60_000
const LEAST = 5
const MOST = 24 * 60

/** A time to confirm or correct: one Finish is about to log, or one it has logged. */
export interface TimeQuestion {
  title: string
  /** Planned minutes of the session */
  planned: number
  /** Minutes the stopwatch counted, or those logged */
  minutes: number
  /** Asked before a long run is logged; null when a logged time is corrected */
  run: LongRun | null
}

interface Props {
  /** The dialog is open while there is one */
  question: TimeQuestion | null
  busy: boolean
  error: string
  /** Logs these minutes, as recalled rather than measured */
  onLog: (minutes: number) => void
  /** Logs the run as the stopwatch measured it: offered only before a long run is logged */
  onLogAll: () => void
  onClose: () => void
}

/**
 * Asks how long the session really took. Before a long run is logged it asks whether all of it was work, since a
 * stopwatch left running makes the outlier that moves a pace most; after Finish it corrects the logged time.
 */
export function LoggedTimeDialog({ question, ...rest }: Props) {
  return (
    <Modal open={question !== null} onClose={rest.onClose}>
      {question && <Ask key={`${question.title}@${question.minutes}`} question={question} {...rest} />}
    </Modal>
  )
}

function Ask({ question, busy, error, onLog, onLogAll, onClose }: Props & { question: TimeQuestion }) {
  const { title, planned, minutes, run } = question
  // A long run starts from nothing chosen, so the counted time is not the default it is asked about.
  const [chosen, setChosen] = useState<number | undefined>(run ? undefined : minutes)
  const valid = chosen !== undefined && chosen >= LEAST && chosen <= MOST && (run !== null || chosen !== minutes)
  const time = fmtDuration(minutes * MINUTE)
  const hint = run
    ? [
        m.focus_check_hint({ time, planned: fmtDuration(planned * MINUTE) }),
        ...(run.overnight ? [m.focus_check_overnight()] : []),
        m.focus_check_why(),
      ].join(' ')
    : m.focus_adjust_hint({ time })

  return (
    <>
      <h3 className={TITLE}>{run ? m.focus_check_title() : m.focus_adjust_title()}</h3>
      <p className={META}>{title}</p>
      <p className="mt-2 text-[13.5px]/[1.45]">{hint}</p>
      <div className="mt-3.5 grid gap-2">
        <span className="text-[13px] font-semibold">{m.focus_worked()}</span>
        <TimeChoices planned={planned} chosen={chosen} disabled={busy} onChoose={setChosen} />
        <label className={`${FIELD} max-w-[220px]`}>
          {m.focus_minutes_label()}
          <input
            type="number"
            inputMode="numeric"
            min={LEAST}
            max={MOST}
            className={`${INPUT} tabular-nums`}
            value={chosen ?? ''}
            disabled={busy}
            onChange={(e) => setChosen(e.target.value === '' ? undefined : Math.round(Number(e.target.value)))}
          />
        </label>
      </div>
      {error && (
        <p className="mt-2 text-[13px] text-today-ink" role="alert">
          {error}
        </p>
      )}
      <div className={FOOT}>
        {run && (
          <Button disabled={busy} onClick={onLogAll}>
            {m.focus_check_all({ time })}
          </Button>
        )}
        <Button onClick={onClose}>{m.cancel()}</Button>
        <Button primary disabled={busy || !valid} onClick={() => valid && onLog(chosen)}>
          {valid ? m.focus_log_time({ time: fmtDuration(chosen * MINUTE) }) : m.save()}
        </Button>
      </div>
    </>
  )
}
