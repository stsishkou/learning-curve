import { fmtDay, fmtHours } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import { parseLocal, type Plan, type PlanChange } from '@lc/plan-domain'
import { PLAN_SCHEMA, UPDATE_SCHEMA, parseUpdate, planBrief, planGuide, previewUpdate } from '@lc/plan-domain/protocol'
import { Button, ExternalLink, FIELD, Hint, INPUT, TriangleAlert } from '@lc/ui'
import { useMemo, useState } from 'react'

import { downloadText } from '../../../shared/lib'
import { PlanDiffList, RuleWarningList } from '../../../shared/ui'

interface Props {
  /** The plan on screen: what the brief describes and the update is checked against */
  plan: Plan
  /** Minsk wall-clock ms; null before the clock is known */
  now: number | null
  /** Stores the changes of an update in order. Absent when the plan cannot be edited. Rejects with the reason */
  onApply?: ((changes: PlanChange[]) => Promise<void>) | undefined
}

const STEP = 'flex items-center gap-2 text-[14px] font-semibold'
const CHIP =
  'rounded-full border border-line bg-surface px-2.5 py-1 text-[12.5px] hover:bg-surface-2 aria-pressed:border-focus aria-pressed:text-focus'
const CODE = 'overflow-x-auto rounded-[10px] bg-surface-2 p-3 font-mono text-[12px]/[1.5] whitespace-pre-wrap'

const TEMPLATES = [
  { id: 'course', label: m.ai_tpl_course, text: m.ai_tpl_course_text },
  { id: 'off', label: m.ai_tpl_off, text: m.ai_tpl_off_text },
  { id: 'behind', label: m.ai_tpl_behind, text: m.ai_tpl_behind_text },
  { id: 'lighter', label: m.ai_tpl_lighter, text: m.ai_tpl_lighter_text },
  { id: 'done', label: m.ai_tpl_done, text: m.ai_tpl_done_text },
  { id: 'habit', label: m.ai_tpl_habit, text: m.ai_tpl_habit_text },
]

// A new, empty conversation of each app: the brief goes in through the clipboard, which works in all of them.
const CHATS = [
  { name: 'Claude', href: 'https://claude.ai/new' },
  { name: 'ChatGPT', href: 'https://chatgpt.com/' },
  { name: 'Gemini', href: 'https://gemini.google.com/app' },
]

const MCP_ENTRY = JSON.stringify(
  { mcpServers: { 'learning-curve': { command: 'pnpm', args: ['--silent', 'run', 'mcp'] } } },
  null,
  2,
)

/** What an agent with HTTP access needs to be told; the addresses are those of the page it is copied from. */
function agentPrompt(origin: string): string {
  return [
    `Change my study plan through its HTTP interface at ${origin}.`,
    `1. GET ${origin}/api/plan-guide?brief=1 and follow it: it holds the rules, the answer format and the plan.`,
    `2. Build one update and POST it as JSON to ${origin}/api/plan-update?dry=1 to see what it would change.`,
    `3. Show me that result. Only after I agree, POST the same update to ${origin}/api/plan-update.`,
    'A 422 answer names the change that does not fit: fix it and send the whole update again.',
  ].join('\n')
}

function toggled(set: ReadonlySet<number>, index: number): ReadonlySet<number> {
  const next = new Set(set)
  if (!next.delete(index)) next.add(index)
  return next
}

/** The line of a change in the list: its type and the thing it names, when it names one. */
function changeLabel(change: PlanChange): string {
  const fields: Record<string, unknown> = { ...change }
  const nested = typeof fields.event === 'object' && fields.event !== null ? { ...fields.event } : {}
  const subject = [fields.title, fields.name, 'title' in nested ? nested.title : undefined, fields.uid].find(
    (value): value is string => typeof value === 'string',
  )
  return subject ? `${change.type} · ${subject}` : change.type
}

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
  const [left, setLeft] = useState<ReadonlySet<number>>(new Set())
  const [pasteFailed, setPasteFailed] = useState(false)

  const brief = now === null ? '' : planBrief(plan, now, { request, descriptions: notes })

  async function copyText(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(what)
    } catch {
      setCopied('failed')
    }
  }

  async function copy(what: 'brief' | 'guide') {
    if (now === null) return
    await copyText(what === 'brief' ? brief : planGuide(plan, now), what)
  }

  function take(text: string) {
    setAnswer(text)
    setLeft(new Set())
    setResult(null)
  }

  async function paste() {
    try {
      take(await navigator.clipboard.readText())
      setPasteFailed(false)
    } catch {
      setPasteFailed(true)
    }
  }

  const read = useMemo(() => {
    if (!answer.trim()) return null
    try {
      const update = parseUpdate(answer)
      const order = update.changes.map((_, index) => index).filter((index) => !left.has(index))
      const kept = update.changes.filter((_, index) => !left.has(index))
      return { update, kept, order, preview: previewUpdate(plan, kept), invalid: '' }
    } catch (err) {
      return {
        update: null,
        kept: [],
        order: [],
        preview: null,
        invalid: err instanceof Error ? err.message : String(err),
      }
    }
  }, [answer, plan, left])

  async function apply(changes: PlanChange[]) {
    if (!onApply) return
    setBusy(true)
    setResult(null)
    try {
      await onApply(changes)
      take('')
      setResult({ ok: true, text: m.ai_applied() })
    } catch (err) {
      setResult({ ok: false, text: m.ai_apply_failed({ reason: err instanceof Error ? err.message : String(err) }) })
    } finally {
      setBusy(false)
    }
  }

  const preview = read?.preview
  // Where the change that does not fit stands in the pasted update, whatever was unticked before it.
  const at = preview?.problem ? (read?.order[preview.problem.index] ?? preview.problem.index) : 0
  // In words the chat can act on: the text that was not an update, or the change that does not fit.
  const problem =
    read?.invalid ||
    (preview?.problem ? `change ${at + 1} (${read?.update.changes[at]?.type}): ${preview.problem.message}` : '')
  const origin = typeof location === 'undefined' ? '' : location.origin
  const { diff } = preview ?? { diff: null }
  const renamed = preview !== null && preview !== undefined && preview.after.meta.title !== plan.meta.title
  const empty =
    diff && !diff.added.length && !diff.removed.length && !diff.changed.length && !preview?.calendars.length && !renamed

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="grid content-start gap-3">
        <p className="text-[13.5px] text-muted">{m.ai_intro()}</p>
        <h4 className={STEP}>
          {m.ai_step_brief()}
          <Hint title={m.help_ai_title()} text={m.help_ai()} />
        </h4>
        <p className="text-[13px] text-muted">{m.ai_brief_hint()}</p>
        <label className={FIELD}>
          {m.ai_request()}
          <textarea
            className={`${INPUT} field-sizing-content max-h-[14lh] min-h-[72px] resize-y`}
            value={request}
            placeholder={m.ai_request_placeholder()}
            onChange={(e) => {
              setRequest(e.target.value)
              setCopied('')
            }}
          />
        </label>
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={m.ai_templates()}>
          <span className="mr-1 text-[12.5px] text-muted">{m.ai_templates()}</span>
          {TEMPLATES.map((template) => (
            <button
              key={template.id}
              type="button"
              className={CHIP}
              aria-pressed={request === template.text()}
              onClick={() => {
                setRequest(template.text())
                setCopied('')
              }}
            >
              {template.label()}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-[13px]">
          <input
            type="checkbox"
            checked={notes}
            onChange={(e) => {
              setNotes(e.target.checked)
              setCopied('')
            }}
          />
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
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          <span className="text-muted">{m.ai_open_in()}</span>
          {CHATS.map((chat) => (
            <a
              key={chat.name}
              className="flex items-center gap-1.5 rounded-[10px] border border-line bg-surface px-3 py-1.5 font-medium hover:bg-surface-2"
              href={chat.href}
              target="_blank"
              rel="noreferrer"
              onClick={() => void copy('brief')}
            >
              {chat.name} <ExternalLink size={13} aria-hidden />
            </a>
          ))}
        </div>
        {copied === 'brief' && <p className="text-[12.5px] text-muted">{m.ai_open_hint()}</p>}
        <details className="rounded-[10px] border border-line-soft px-3.5 py-2.5 text-[13px]">
          <summary className="cursor-pointer font-medium">{m.ai_connect()}</summary>
          <div className="mt-3 grid gap-2.5">
            <p className="text-muted">{m.ai_connect_agent()}</p>
            <pre className={CODE}>{agentPrompt(origin)}</pre>
            <div>
              <Button onClick={() => void copyText(agentPrompt(origin), 'agent')}>
                {copied === 'agent' ? m.copied() : m.ai_copy()}
              </Button>
            </div>
            <p className="text-muted">{m.ai_connect_mcp()}</p>
            <pre className={CODE}>{MCP_ENTRY}</pre>
            <div>
              <Button onClick={() => void copyText(MCP_ENTRY, 'mcp')}>
                {copied === 'mcp' ? m.copied() : m.ai_copy()}
              </Button>
            </div>
            <p className="text-[12.5px]/[1.5] text-muted">{m.ai_tools()}</p>
          </div>
        </details>
      </section>

      <section className="grid content-start gap-3">
        <h4 className={STEP}>{m.ai_step_answer()}</h4>
        <textarea
          className={`${INPUT} field-sizing-content max-h-[24lh] min-h-[120px] resize-y font-mono text-[12.5px]`}
          aria-label={m.ai_step_answer()}
          value={answer}
          spellCheck={false}
          placeholder={m.ai_answer_placeholder()}
          onChange={(e) => take(e.target.value)}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => void paste()}>{m.ai_paste()}</Button>
          {answer && <Button onClick={() => take('')}>{m.ai_clear()}</Button>}
          {pasteFailed && (
            <span className="text-[12.5px] text-today-ink" role="alert">
              {m.ai_paste_failed()}
            </span>
          )}
        </div>
        {read?.invalid && (
          <p className="text-[13px] text-today-ink" role="alert">
            {m.ai_invalid({ reason: read.invalid })}
          </p>
        )}
        {problem && (
          <div>
            <Button onClick={() => void copyText(m.ai_fix_request({ reason: problem }), 'fix')}>
              {copied === 'fix' ? m.copied() : m.ai_copy_fix()}
            </Button>
          </div>
        )}
        {read?.update && preview && (
          <>
            <h4 className={STEP}>{m.ai_step_check()}</h4>
            {read.update.summary && (
              <p className="rounded-[10px] bg-surface-2 px-3.5 py-2.5 text-[13.5px]">{read.update.summary}</p>
            )}
            <p className="text-[13px] text-muted">{m.ai_changes_count({ count: read.update.changes.length })}</p>
            {read.update.changes.length > 1 && (
              <details className="rounded-[10px] border border-line-soft px-3.5 py-2.5 text-[13px]">
                <summary className="cursor-pointer">
                  {m.ai_changes_list()}
                  {left.size > 0 &&
                    ` · ${m.ai_changes_left({ count: read.kept.length, total: read.update.changes.length })}`}
                </summary>
                <ul className="mt-2 grid gap-1">
                  {read.update.changes.map((change, index) => (
                    // oxlint-disable-next-line react/no-array-index-key -- the list is the pasted update: it never reorders
                    <li key={index}>
                      <label className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={!left.has(index)}
                          onChange={() => setLeft(toggled(left, index))}
                        />
                        <span className="min-w-0 break-words">
                          {index + 1}. {changeLabel(change)}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {preview.problem && (
              <p className="flex items-start gap-2 text-[13px]/[1.45] text-today-ink" role="alert">
                <TriangleAlert size={15} aria-hidden className="mt-0.5 flex-none" />
                {m.ai_problem({ index: at + 1, reason: preview.problem.message })}
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
            <RuleWarningList warnings={preview.warnings} />
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
                disabled={busy || !onApply || preview.problem !== null || read.kept.length === 0}
                onClick={() => void apply(read.kept)}
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
