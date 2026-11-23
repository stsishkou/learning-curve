import { fmtDay } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import { parseLocal, previewUpdate, type InboxItem, type Plan, type PlanEvent } from '@lc/plan-domain'

import { changeText, slotText } from '../../../shared/ui'

export interface ProposalRow {
  item: InboxItem
  /** The plan event it is about; absent when the plan no longer has it */
  event: PlanEvent | undefined
  /** What accepting it would do, in a few words */
  detail: string
  /** Why it cannot be accepted as it is; empty when it can */
  problem: string
}

/** One proposal from Google as a row of the review: the event and what accepting it changes. */
export function describeProposal(plan: Plan, item: InboxItem): ProposalRow {
  const event = plan.events.find((e) => e.uid === item.uid)
  if (!item.change) return { item, event, detail: m.google_deleted(), problem: '' }
  const preview = previewUpdate(plan, [item.change])
  if (preview.problem)
    return { item, event, detail: '', problem: m.google_not_fit({ reason: preview.problem.message }) }
  const changed = preview.diff.changed.find((c) => c.before.uid === item.uid)
  const added = preview.diff.added.at(0)
  const detail =
    item.change.type === 'event.detach' && added
      ? `${fmtDay(parseLocal(`${item.change.day}T00:00`))} → ${slotText(added)}`
      : changed
        ? changeText(changed.before, changed.after)
        : m.diff_details()
  return { item, event, detail, problem: '' }
}
