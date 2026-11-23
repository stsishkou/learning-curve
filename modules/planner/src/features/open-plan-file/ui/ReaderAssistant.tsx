import { fmtDay, fmtHours } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import {
  PLAN_SCHEMA,
  UPDATE_SCHEMA,
  parseLocal,
  parseUpdate,
  planBrief,
  planGuide,
  previewUpdate,
  type Plan,
  type PlanChange,
} from '@lc/plan-domain'
import { Button, FIELD, INPUT, TriangleAlert } from '@lc/ui'
import { useMemo, useState } from 'react'

import { downloadText } from '../../../shared/lib'
import { PlanDiffList } from './PlanDiffList'

interface Props {
  /** The plan on screen: what the brief describes and the update is checked against */
  plan: Plan
  /** Minsk wall-clock ms; null before the clock is known */
  now: number | null
  /** Stores the changes of an update in order. Absent when the plan cannot be edited. Rejects with the reason */
  onApply?: (changes: PlanChange[]) => Promise<void>
}

const STEP = 'text-[14px] font-semibold'

/**
 * The way to change the plan with any chat: copy a brief (the rules of the plan, how to answer, the plan itself),
 * paste the answer back, see what it would change and apply it. Nothing leaves the page except through the
 * clipboard.
 */
export function ReaderAssistant({ plan, now, onApply }: Props) {
  const [request, setRequest] = useState('')
  const [notes, setNotes] = useState(false)
  const [copied, setCopied] = useState('')
  const [answer, setAnswer] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)

  const brief = now === null ? '' : planBrief(plan, now, { request, descriptions: notes })

  async function copy(what: 'brief' | 'guide') {
    if (now === null) return
    try {
      await navigator.clipboard.writeText(what === 'brief' ? brief : planGuide(plan, now))
      setCopied(what)
    } catch {
      setCopied('failed')
    }
  }

  const read = useMemo(() => {
    if (!answer.trim()) return null
    try {
      const update = parseUpdate(answer)
      return { update, preview: previewUpdate(plan, update.changes), invalid: '' }
    } catch (err) {
      return { update: null, preview: null, invalid: err instanceof Error ? err.message : String(err) }
    }
  }, [answer, plan])

  async function apply(changes: PlanChange[]) {
    if (!onApply) return
    setBusy(true)
    setResult(null)
    try {
      await onApply(changes)
      setAnswer('')
      setResult({ ok: true, text: m.ai_applied() })
    } catch (err) {
      setResult({ ok: false, text: m.ai_apply_failed({ reason: err instanceof Error ? err.message : String(err) }) })
    } finally {
      setBusy(false)
    }
  }

  const preview = read?.preview
  const { diff } = preview ?? { diff: null }
  const empty = diff && !diff.added.length && !diff.removed.length && !diff.changed.length && !preview?.calendars.length

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="grid content-start gap-3">
        <p className="text-[13.5px] text-muted">{m.ai_intro()}</p>
        <h4 className={STEP}>{m.ai_step_brief()}</h4>
        <p className="text-[13px] text-muted">{m.ai_brief_hint()}</p>
        <label className={FIELD}>
          {m.ai_request()}
          <textarea
            className={`${INPUT} min-h-[72px] resize-y`}
            value={request}
            placeholder={m.ai_request_placeholder()}
            onChange={(e) => (setRequest(e.target.value), setCopied(''))}
          />
        </label>
        <label className="flex items-center gap-2 text-[13px]">
          <input type="checkbox" checked={notes} onChange={(e) => (setNotes(e.target.checked), setCopied(''))} />
          {m.ai_with_notes()}
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <Button primary disabled={now === null} onClick={() => void copy('brief')}>
            {copied === 'brief' ? m.copied() : m.ai_copy_brief()}
          </Button>
          <Button disabled={now === null} onClick={() => void copy('guide')}>
            {copied === 'guide' ? m.copied() : m.ai_copy_guide()}
          </Button>
          <Button
            onClick={() =>
              downloadText(
                'plan-schema.json',
                JSON.stringify({ plan: PLAN_SCHEMA, update: UPDATE_SCHEMA }, null, 2),
                'application/json',
              )
            }
          >
            {m.ai_download_schema()}
          </Button>
          <span className="text-[12.5px] text-muted" role="status">
            {copied === 'failed' ? m.copy_failed() : m.ai_brief_size({ size: Math.round(brief.length / 1024) })}
          </span>
        </div>
        <p className="text-[12.5px]/[1.5] text-muted">{m.ai_tools()}</p>
      </section>

      <section className="grid content-start gap-3">
        <h4 className={STEP}>{m.ai_step_answer()}</h4>
        <textarea
          className={`${INPUT} min-h-[120px] resize-y font-mono text-[12.5px]`}
          aria-label={m.ai_step_answer()}
          value={answer}
          spellCheck={false}
          placeholder={m.ai_answer_placeholder()}
          onChange={(e) => (setAnswer(e.target.value), setResult(null))}
        />
        {read?.invalid && (
          <p className="text-[13px] text-today-ink" role="alert">
            {m.ai_invalid({ reason: read.invalid })}
          </p>
        )}
        {read?.update && preview && (
          <>
            <h4 className={STEP}>{m.ai_step_check()}</h4>
            {read.update.summary && (
              <p className="rounded-[10px] bg-surface-2 px-3.5 py-2.5 text-[13.5px]">{read.update.summary}</p>
            )}
            <p className="text-[13px] text-muted">{m.ai_changes_count({ count: read.update.changes.length })}</p>
            {preview.problem && (
              <p className="flex items-start gap-2 text-[13px]/[1.45] text-today-ink" role="alert">
                <TriangleAlert size={15} aria-hidden className="mt-0.5 flex-none" />
                {m.ai_problem({ index: preview.problem.index + 1, reason: preview.problem.message })}
              </p>
            )}
            {preview.calendars.length > 0 && (
              <p className="text-[13px]">
                {m.ai_new_calendars({ names: preview.calendars.map((c) => c.name).join(', ') })}
              </p>
            )}
            {preview.overBudget.length > 0 && (
              <p className="flex items-start gap-2 text-[13px]/[1.45] text-today-ink" role="status">
                <TriangleAlert size={15} aria-hidden className="mt-0.5 flex-none" />
                {m.ai_over_budget({
                  budget: fmtHours(plan.meta.weeklyBudgetHours),
                  weeks: preview.overBudget
                    .map((w) => `${fmtDay(parseLocal(`${w.week}T00:00`))} (${fmtHours(w.hours)})`)
                    .join(', '),
                })}
              </p>
            )}
            {empty && !preview.problem && <p className="text-[13px] text-muted">{m.ai_nothing()}</p>}
            {diff && (
              <PlanDiffList
                diff={diff}
                after={preview.after}
                before={plan}
                labels={{
                  added: (count) => m.ai_added({ count }),
                  removed: (count) => m.ai_removed({ count }),
                  changed: (count) => m.file_changed({ count }),
                }}
              />
            )}
            <div className="flex flex-wrap items-center gap-3">
              <Button
                primary
                disabled={busy || !onApply || preview.problem !== null}
                onClick={() => void apply(read.update.changes)}
              >
                {m.ai_apply()}
              </Button>
              {!onApply && <span className="text-[12.5px] text-muted">{m.ai_read_only()}</span>}
            </div>
          </>
        )}
        {result && (
          <p
            className={`text-[13px] ${result.ok ? 'text-done-ink' : 'text-today-ink'}`}
            role={result.ok ? 'status' : 'alert'}
          >
            {result.text}
          </p>
        )}
      </section>
    </div>
  )
}
