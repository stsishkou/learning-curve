import { m } from '@lc/i18n/messages'
import type { Plan, PlanChange } from '@lc/plan-domain'
import { previewUpdate } from '@lc/plan-domain/protocol'
import { Button, calendarColor, Dot, FOOT, META, Modal, TITLE } from '@lc/ui'
import { useMemo } from 'react'

import { appName } from '../../../shared/lib'
import { RuleWarningList } from '../../../shared/ui'
import { describeProposal } from '../model/describe'
import type { HeldEdit } from '../model/source'

interface Props {
  open: boolean
  plan: Plan
  items: HeldEdit[]
  /** A decision is being stored */
  working: boolean
  /** Why the last decision failed; empty when it did not */
  error: string
  onAccept: (ids: string[]) => void
  onKeep: (ids: string[]) => void
  onClose: () => void
}

/**
 * The edits made in calendar apps that were not taken in by themselves, one row each: the planner changed the same
 * thing, or the plan cannot take them. Each shows what using it would change and the rules it would break; neither
 * choice is the default, since only the person knows which version stands.
 */
export function CalendarReviewDialog({ open, plan, items, working, error, onAccept, onKeep, onClose }: Props) {
  const rows = useMemo(() => items.map((item) => describeProposal(plan, item)), [plan, items])
  const warnings = useMemo(() => {
    const changes = items.flatMap((item): PlanChange[] => (item.change ? [item.change] : []))
    return changes.length ? previewUpdate(plan, changes).warnings : []
  }, [plan, items])
  const fitting = rows.filter((row) => !row.problem).map((row) => row.item.id)

  return (
    <Modal open={open} onClose={onClose} size="wide">
      <h2 className={TITLE}>{m.sync_review_title()}</h2>
      <p className={META}>{m.sync_review_hint()}</p>
      <ul className="mt-4 grid grid-cols-1 gap-2">
        {rows.map(({ item, event, detail, problem }) => (
          <li
            key={item.id}
            className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-line-soft px-3 py-2 text-[13.5px]"
            style={calendarColor(plan.calendars.find((c) => c.id === event?.calendar)?.color)}
          >
            <span className="flex min-w-0 flex-1 basis-60 items-baseline gap-2">
              <Dot className="size-2 flex-none -translate-y-px" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{event?.title ?? m.sync_unknown()}</span>
                <span className={`block text-[12.5px] ${problem ? 'text-today-ink' : 'text-muted'}`}>
                  {problem || detail}
                </span>
                {item.hold === 'both' && !problem && (
                  <span className="block text-[12.5px] text-today-ink">{m.sync_both()}</span>
                )}
              </span>
            </span>
            <span className="flex flex-none gap-2">
              <Button disabled={working} onClick={() => onKeep([item.id])}>
                {m.sync_keep()}
              </Button>
              <Button disabled={working || Boolean(problem)} onClick={() => onAccept([item.id])}>
                {m.sync_accept({ app: appName(item.provider) })}
              </Button>
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-3">
        <RuleWarningList warnings={warnings} />
      </div>
      {error && (
        <p className="mt-2 text-[13px] text-today-ink" role="alert">
          {m.sync_failed({ reason: error })}
        </p>
      )}
      <div className={FOOT}>
        <Button className="mr-auto" onClick={onClose}>
          {m.close()}
        </Button>
        <Button disabled={working || !items.length} onClick={() => onKeep(items.map((item) => item.id))}>
          {m.sync_keep_all()}
        </Button>
        <Button disabled={working || !fitting.length} onClick={() => onAccept(fitting)}>
          {m.sync_accept_all()}
        </Button>
      </div>
    </Modal>
  )
}
