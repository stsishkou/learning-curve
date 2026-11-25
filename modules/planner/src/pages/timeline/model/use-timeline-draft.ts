import { m } from '@lc/i18n/messages'
import {
  deadlineChange,
  previewUpdate,
  rebalanceChange,
  type Plan,
  type PlanChange,
  type UpdatePreview,
} from '@lc/plan-domain'
import { useEffect, useMemo, useRef, useState } from 'react'

import { finishByRequest, type Rebalance } from '../../../features/reschedule'

/** What the draft does to one course. A move and a finish-by day exclude each other: they are Reschedule's two modes. */
export interface CourseEdit {
  /** Days the open sessions from today on move by; whole weeks */
  move?: number | undefined
  /** The day the course is re-balanced to finish by, `YYYY-MM-DD` */
  finishBy?: string | undefined
  /** The course's new deadline, `YYYY-MM-DD` */
  deadline?: string | undefined
}

type Courses = [calendar: string, edit: CourseEdit][]

interface Worked {
  /** The plan and the draft the changes were worked out for */
  plan: Plan
  courses: Courses
  changes: PlanChange[]
  /** Courses whose changes could not be worked out, with the reason */
  failed: Map<string, string>
}

interface Options {
  plan: Plan
  /** `YYYY-MM-DD`; null before the clock is known: nothing is worked out until then */
  today: string | null
  rebalance?: Rebalance | undefined
}

/** A patch over an edit: a key present in it replaces the old value, `undefined` clears it. */
function merge(old: CourseEdit = {}, patch: CourseEdit): CourseEdit | null {
  let move = 'move' in patch ? patch.move : old.move
  let finishBy = 'finishBy' in patch ? patch.finishBy : old.finishBy
  const deadline = 'deadline' in patch ? patch.deadline : old.deadline
  if ('move' in patch && move) finishBy = undefined
  if ('finishBy' in patch && finishBy) move = undefined
  const next: CourseEdit = {
    ...(move ? { move } : {}),
    ...(finishBy ? { finishBy } : {}),
    ...(deadline ? { deadline } : {}),
  }
  return Object.keys(next).length ? next : null
}

const reasonOf = (err: unknown) => (err instanceof Error ? err.message : String(err))

/** The changes of one course, worked out on the plan the courses before it leave. */
async function changesOf(
  plan: Plan,
  calendar: string,
  edit: CourseEdit,
  today: string,
  rebalance: Rebalance | undefined,
): Promise<PlanChange[]> {
  const own: PlanChange[] = []
  const step = edit.deadline ? deadlineChange(plan, calendar, edit.deadline) : null
  if (step) own.push(step)
  if (edit.move) own.push({ type: 'events.shift', calendars: [calendar], from: today, days: edit.move })
  else if (edit.finishBy && rebalance) {
    const base = own.length ? previewUpdate(plan, own).after : plan
    const result = await rebalance(base, finishByRequest(base, { calendar, from: today, finishBy: edit.finishBy }))
    const { unplaced } = result.report
    if (unplaced > 0) throw new Error(m.reschedule_unplaced({ count: unplaced }))
    const moves = rebalanceChange(result, calendar)
    if (moves) own.push(moves)
  }
  return own
}

/**
 * The timeline's draft: what the person asked of each course, in the order the courses were first touched, worked
 * out into the plan changes that would do it, and previewed. Nothing here stores anything. While a re-balance is
 * worked out the last result stays on screen; an answer to a draft that has changed since is dropped.
 */
export function useTimelineDraft({ plan, today, rebalance }: Options) {
  const [courses, setCourses] = useState<Courses>([])
  const [worked, setWorked] = useState<Worked | null>(null)
  const newest = useRef(0)

  useEffect(() => {
    const id = ++newest.current
    if (today === null || !courses.length) return
    async function work(day: string) {
      let current = plan
      const changes: PlanChange[] = []
      const failed = new Map<string, string>()
      for (const [calendar, edit] of courses) {
        try {
          // oxlint-disable-next-line no-await-in-loop -- each course is worked out on the plan the ones before it leave
          const own = await changesOf(current, calendar, edit, day, rebalance)
          changes.push(...own)
          if (own.length) current = previewUpdate(current, own).after
        } catch (err) {
          failed.set(calendar, reasonOf(err))
        }
      }
      if (id === newest.current) setWorked({ plan, courses, changes, failed })
    }
    void work(today)
  }, [plan, courses, today, rebalance])

  const current = worked?.plan === plan && worked.courses === courses
  const shown = courses.length ? worked : null
  const changes = useMemo(() => shown?.changes ?? [], [shown])
  const preview = useMemo<UpdatePreview | null>(
    () => (changes.length ? previewUpdate(plan, changes) : null),
    [plan, changes],
  )
  const working = new Set(current ? [] : courses.filter(([, edit]) => edit.finishBy).map(([calendar]) => calendar))
  const failed = shown?.failed ?? new Map<string, string>()

  return {
    courses: new Map(courses),
    /** Changes the course's edit by a patch; null drops the course from the draft */
    set: (calendar: string, patch: CourseEdit | null) =>
      setCourses((prev) => {
        const at = prev.findIndex(([id]) => id === calendar)
        const next = patch === null ? null : merge(prev[at]?.[1], patch)
        if (at < 0) return next ? [...prev, [calendar, next]] : prev
        return next ? prev.map((entry, i) => (i === at ? [calendar, next] : entry)) : prev.filter((_, i) => i !== at)
      }),
    discard: () => {
      setCourses([])
      // Or the next draft would show this one's changes until its own are worked out.
      setWorked(null)
    },
    changes,
    preview,
    working,
    failed,
    /** The changes belong to the draft as it is now, every course worked out, and all of them fit the plan */
    ready: current && changes.length > 0 && failed.size === 0 && preview?.problem === null,
  }
}

export type TimelineDraft = ReturnType<typeof useTimelineDraft>
