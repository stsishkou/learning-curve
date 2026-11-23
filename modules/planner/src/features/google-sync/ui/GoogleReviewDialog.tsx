import { m } from '@lc/i18n/messages'
import { previewUpdate, type InboxItem, type Plan, type PlanChange } from '@lc/plan-domain'
import { Button, calendarColor, Dot, FOOT, META, Modal, TITLE } from '@lc/ui'
import { useMemo } from 'react'

import { RuleWarningList } from '../../../shared/ui'
import { describeProposal } from '../model/describe'

interface Props {
  open: boolean
  plan: Plan
  items: InboxItem[]
  /** A decision is being stored */
  working: boolean
  /** Why the last decision failed; empty when it did not */
  error: string
  onAccept: (ids: string[]) => void
  onKeep: (ids: string[]) => void
  onClose: () => void
}

/**
 * The edits made in Google Calendar, one row each, with what accepting it would change in the plan and the rules of
 * the plan it would break. Each can be taken into the plan, or kept out by writing the plan's version back.
 */
export function GoogleReviewDialog({ open, plan, items, working, error, onAccept, onKeep, onClose }: Props) {
  const rows = useMemo(() => items.map((item) => describeProposal(plan, item)), [plan, items])
  const warnings = useMemo(() => {
    const changes = items.flatMap((item): PlanChange[] => (item.change ? [item.change] : []))
    return changes.length ? previewUpdate(plan, changes).warnings : []
  }, [plan, items])
  const fitting = rows.filter((row) => !row.problem).map((row) => row.item.id)

  return (
    <Modal open={open} onClose={onClose} size="wide">
      <h2 className={TITLE}>{m.google_review_title()}</h2>
      <p className={META}>{m.google_review_hint()}</p>
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
                <span className="block truncate font-medium">{event?.title ?? m.google_unknown()}</span>
                <span className={`block text-[12.5px] ${problem ? 'text-today-ink' : 'text-muted'}`}>
                  {problem || detail}
                </span>
              </span>
            </span>
            <span className="flex flex-none gap-2">
              <Button disabled={working} onClick={() => onKeep([item.id])}>
                {m.google_keep()}
              </Button>
              <Button primary disabled={working || Boolean(problem)} onClick={() => onAccept([item.id])}>
                {m.google_accept()}
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
          {m.google_failed({ reason: error })}
        </p>
      )}
      <div className={FOOT}>
        <Button className="mr-auto" onClick={onClose}>
          {m.close()}
        </Button>
        <Button disabled={working || !items.length} onClick={() => onKeep(items.map((item) => item.id))}>
          {m.google_keep_all()}
        </Button>
        <Button primary disabled={working || !fitting.length} onClick={() => onAccept(fitting)}>
          {m.google_accept_all()}
        </Button>
      </div>
    </Modal>
  )
}
