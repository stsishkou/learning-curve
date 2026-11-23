import { m } from '@lc/i18n/messages'
import { addDays, previewUpdate, ymd, type Plan, type PlanChange } from '@lc/plan-domain'
import { useState } from 'react'

import { deadlineChange, type ReschedulePreset } from '../../../features/reschedule'
import type { LaneEditing } from '../../../widgets/timeline-lanes'

/** The Reschedule dialog as the page opens it: from a day, with what a lane asked for */
export interface RescheduleRequest {
  from: string
  preset?: ReschedulePreset | undefined
}

interface Context {
  plan: Plan
  /** Day ms of today; null before the clock is known */
  today: number | null
  canEdit: boolean
  canRebalance: boolean
  /** Where the history stands now */
  cursor: number
  change: (change: PlanChange) => void
  open: (request: RescheduleRequest) => void
}

/**
 * What the timeline's lanes do on the planner: a move that breaks no rule and a new deadline are stored at once, with
 * Undo; a move that does, and a new end, open Reschedule so the result is seen before it is stored. Right after a
 * deadline moves, the Undo bar offers to re-balance the course to it.
 */
export function useTimelineEdit({ plan, today, canEdit, canRebalance, cursor, change, open }: Context) {
  const [moved, setMoved] = useState<{ calendar: string; day: string; cursor: number } | null>(null)
  if (!canEdit || today === null) return { edit: undefined, offer: undefined }
  const from = ymd(today)

  const edit: LaneEditing = {
    onOpen: (calendar) => open({ from, preset: { calendar, mode: 'move' } }),
    onMove: (calendar, days) => {
      const step: PlanChange = { type: 'events.shift', calendar, from, days }
      const preview = previewUpdate(plan, [step])
      if (preview.problem === null && preview.warnings.length === 0) change(step)
      else open({ from, preset: { calendar, mode: 'move', days } })
    },
    onFinish: canRebalance
      ? (calendar, day) => open({ from, preset: { calendar, mode: 'rebalance', finishBy: day } })
      : undefined,
    onDeadline: (calendar, day) => {
      const step = deadlineChange(plan, calendar, day)
      if (!step) return
      change(step)
      // The step lands one past the cursor: the offer holds only while that step is the last one.
      setMoved({ calendar, day, cursor: cursor + 1 })
    },
  }
  const offer =
    canRebalance && moved?.cursor === cursor
      ? {
          label: m.timeline_rebalance_to_deadline(),
          run: () =>
            open({
              from,
              preset: { calendar: moved.calendar, mode: 'rebalance', finishBy: addDays(moved.day, -1) },
            }),
        }
      : undefined
  return { edit, offer }
}
