import { fmtDay, fmtShort } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import {
  DAY,
  currentRhythm,
  isSession,
  nearestRhythm,
  parseLocal,
  toLocalString,
  type Plan,
  type RebalanceReport,
  type RebalanceRequest,
  type RebalanceResult,
  type SessionMove,
} from '@lc/plan-domain'
import { fixturePlan } from '@lc/plan-domain/fixtures'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fireEvent, fn, userEvent, waitFor, within } from 'storybook/test'

import { RescheduleDialog } from './RescheduleDialog'

const FROM = '2026-12-07'
const moves: SessionMove[] = fixturePlan.events
  .filter((e) => e.calendar === 'hfllm' && isSession(e) && !e.done)
  .slice(0, 2)
  .map((e) => ({
    uid: e.uid,
    start: toLocalString(parseLocal(e.start) + DAY),
    end: toLocalString(parseLocal(e.end) + DAY),
  }))

const report = (overrides: Partial<RebalanceReport> = {}): RebalanceReport => ({
  finish: '2027-02-15',
  finishBefore: '2027-02-22',
  deadline: null,
  peakWeek: 12,
  peakDay: 2,
  overWeeks: [],
  moved: moves.length,
  late: 0,
  unplaced: 0,
  provenBest: true,
  reasons: [],
  ...overrides,
})
const result = (overrides: Partial<RebalanceReport> = {}): RebalanceResult => ({ moves, report: report(overrides) })

const day = (ymd: string) => parseLocal(`${ymd}T00:00`)
const ends = (finish: string, before = '2027-02-22') =>
  m.reschedule_ends({ day: fmtDay(day(finish)), before: fmtDay(day(before)) })

const pause = async (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const nameOf = (id: string) => fixturePlan.calendars.find((c) => c.id === id)?.name ?? id

/** Ticks the calendar's chip */
async function pick(canvasElement: HTMLElement, id: string) {
  const body = within(canvasElement.ownerDocument.body)
  await userEvent.click(await body.findByRole('checkbox', { name: nameOf(id) }))
}

/** One calendar, then the Re-balance mode: the dialog asks for an answer at the default rhythm. */
async function rebalanceLlm(canvasElement: HTMLElement) {
  const body = within(canvasElement.ownerDocument.body)
  await pick(canvasElement, 'hfllm')
  await userEvent.click(body.getByRole('button', { name: m.reschedule_rebalance() }))
}

const meta = {
  title: 'Planner/Features/RescheduleDialog',
  component: RescheduleDialog,
  parameters: { dialog: true, docs: { story: { inline: false, iframeHeight: 720 } } },
  args: {
    plan: fixturePlan,
    from: FROM,
    onApply: fn(async () => {}),
    onClose: fn(),
    rebalance: fn(async () => result()),
  },
  argTypes: { plan: { control: false } },
} satisfies Meta<typeof RescheduleDialog>

export default meta
type Story = StoryObj<typeof meta>

/** Every open session from the chosen day moves by the same days and hours, in every calendar or in those picked. */
export const Default: Story = {}

/** Studying an hour later: a shift by hours alone, with no days in it. */
export const MoveByAnHour: Story = {
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    await userEvent.click(await body.findByRole('button', { name: m.reschedule_hour_later() }))
    await userEvent.click(body.getByRole('button', { name: m.reschedule_apply() }))
    await expect(args.onApply).toHaveBeenCalledWith([{ type: 'events.shift', from: FROM, hours: 1 }])
  },
}

const openIn = (ids: string[]) =>
  fixturePlan.events.filter((e) => ids.includes(e.calendar) && isSession(e) && !e.done && e.start >= FROM).length

/**
 * Two courses a week later: their open sessions move and the others stay. A deadline belongs to one course, so its
 * field is gone while two are picked; All calendars takes everything again.
 */
export const MoveSeveralCalendars: Story = {
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    const all = await body.findByRole('checkbox', { name: m.shift_all() })
    await expect(all).toBeChecked()
    await pick(canvasElement, 'hfllm')
    await waitFor(() => expect(body.getByLabelText(new RegExp(`^${m.reschedule_deadline()}`))).toBeVisible())
    await pick(canvasElement, 'pypy')
    await expect(all).not.toBeChecked()
    await expect(body.queryByLabelText(new RegExp(`^${m.reschedule_deadline()}`))).toBeNull()
    await expect(body.getByText(m.shift_count({ count: openIn(['hfllm', 'pypy']) }))).toBeVisible()
    await userEvent.click(body.getByRole('button', { name: m.reschedule_apply() }))
    await expect(args.onApply).toHaveBeenCalledWith([
      { type: 'events.shift', calendars: ['hfllm', 'pypy'], from: FROM, days: 7 },
    ])
    await userEvent.click(all)
    await expect(body.getByRole('checkbox', { name: nameOf('hfllm') })).not.toBeChecked()
    await expect(body.getByText(m.shift_count({ count: openIn(fixturePlan.calendars.map((c) => c.id)) }))).toBeVisible()
  },
}

/** A re-balance takes one course: with two picked it asks for one, and a chip then picks only that one. */
export const RebalanceTakesOneCalendar: Story = {
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    await pick(canvasElement, 'hfllm')
    await pick(canvasElement, 'pypy')
    await userEvent.click(body.getByRole('button', { name: m.reschedule_rebalance() }))
    await waitFor(() => expect(body.getByText(m.reschedule_need_calendar())).toBeVisible())
    await expect(body.queryByRole('radio', { checked: true })).toBeNull()
    await userEvent.click(body.getByRole('radio', { name: nameOf('pypy') }))
    await expect(body.queryByText(m.reschedule_need_calendar())).toBeNull()
    await waitFor(() =>
      expect(args.rebalance).toHaveBeenLastCalledWith(fixturePlan, expect.objectContaining({ calendar: 'pypy' })),
    )
  },
}

const firstOpen = fixturePlan.events
  .filter((e) => e.calendar === 'hfllm' && isSession(e) && !e.done && e.start >= FROM)
  .toSorted((a, b) => a.start.localeCompare(b.start))
  .at(0)
const talk = firstOpen && {
  ...firstOpen,
  uid: 'talk',
  calendar: 'personal',
  title: 'Talk',
  kind: 'personal' as const,
  start: firstOpen.end,
  end: toLocalString(parseLocal(firstOpen.end) + 60 * 60 * 1000),
}

/** A move warns before it is stored: an hour later, the first session would sit on a talk. */
export const MoveOntoAnotherEvent: Story = {
  args: { plan: talk ? { ...fixturePlan, events: [...fixturePlan.events, talk] } : fixturePlan },
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    await pick(canvasElement, 'hfllm')
    await userEvent.click(body.getByRole('button', { name: m.reschedule_hour_later() }))
    const overlap = m.ai_warn_overlap({ title: firstOpen?.title ?? '', other: 'Talk' })
    await waitFor(() => expect(body.getByText(overlap)).toBeVisible())
    await expect(args.onApply).not.toHaveBeenCalled()
  },
}

const RHYTHM_LABELS = new Map<number, () => string>([
  [1 / 3, m.reschedule_rhythm_1_3],
  [1 / 2, m.reschedule_rhythm_1_2],
  [1, m.reschedule_rhythm_1],
  [3 / 2, m.reschedule_rhythm_3_2],
  [2, m.reschedule_rhythm_2],
  [3, m.reschedule_rhythm_3],
])

/**
 * The rhythm says how fast the course goes now, so a choice reads as faster or slower than that; picking Finish by
 * puts a day in the place of the rhythms, as the one aim the re-balance follows.
 */
export const RhythmAgainstTheCurrentOne: Story = {
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    await rebalanceLlm(canvasElement)
    const now = currentRhythm(fixturePlan, 'hfllm', FROM)
    const label = RHYTHM_LABELS.get(nearestRhythm(now ?? 1))?.() ?? ''
    await waitFor(() => expect(body.getByText(m.reschedule_rhythm_now({ rhythm: label }))).toBeVisible())
    await expect(body.getByText(m.reschedule_rhythm_hint())).toBeVisible()
    await userEvent.click(body.getByRole('button', { name: m.reschedule_finish_by() }))
    await expect(body.queryByRole('button', { name: m.reschedule_rhythm_1_2() })).toBeNull()
    await expect(body.getByText(m.reschedule_finish_hint())).toBeVisible()
  },
}

/** The rhythm the LLM course has now, as the dialog offers it */
const usual = nearestRhythm(currentRhythm(fixturePlan, 'hfllm', FROM) ?? 1)
/** A rhythm other than the usual one */
const other = usual === 1 / 2 ? 2 : 1 / 2

/** The rhythm starts at the course's own, so the first answer keeps its rhythm and only evens it out. */
export const RhythmStartsAtTheCurrentOne: Story = {
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    await rebalanceLlm(canvasElement)
    await waitFor(() =>
      expect(args.rebalance).toHaveBeenLastCalledWith(
        fixturePlan,
        expect.objectContaining({ calendar: 'hfllm', target: { mode: 'rhythm', perDay: usual } }),
      ),
    )
    const label = RHYTHM_LABELS.get(usual)?.() ?? ''
    await expect(body.getByRole('button', { name: label })).toHaveAttribute('aria-pressed', 'true')
  },
}

/** One every two days: the dialog asks for that rhythm and shows when the course ends then. */
export const RebalanceByRhythm: Story = {
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    await rebalanceLlm(canvasElement)
    await userEvent.click(body.getByRole('button', { name: m.reschedule_rhythm_1_2() }))
    await waitFor(() =>
      expect(args.rebalance).toHaveBeenLastCalledWith(
        fixturePlan,
        expect.objectContaining({ calendar: 'hfllm', from: FROM, target: { mode: 'rhythm', perDay: 0.5 } }),
      ),
    )
    await expect(await body.findByText(ends('2027-02-15'))).toBeVisible()
  },
}

/**
 * A deadline typed for a calendar that has none: Finish by follows it to the day before, and Apply stores it as the
 * calendar's milestone before the moves.
 */
export const FinishBy: Story = {
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    await rebalanceLlm(canvasElement)
    await userEvent.click(body.getByRole('button', { name: m.reschedule_finish_by() }))
    await fireEvent.change(body.getByLabelText(new RegExp(`^${m.reschedule_deadline()}`)), {
      target: { value: '2027-02-16' },
    })
    await expect(body.getByLabelText(m.reschedule_finish_by(), { selector: 'input[type="date"]' })).toHaveValue(
      '2027-02-15',
    )
    await waitFor(() =>
      expect(args.rebalance).toHaveBeenLastCalledWith(
        fixturePlan,
        expect.objectContaining({ deadline: '2027-02-16', target: { mode: 'deadline' } }),
      ),
    )
    const apply = body.getByRole('button', { name: m.reschedule_apply() })
    await waitFor(() => expect(apply).toBeEnabled())
    await userEvent.click(apply)
    await expect(args.onApply).toHaveBeenCalledWith([
      {
        type: 'event.add',
        event: {
          calendar: 'hfllm',
          title: 'Дедлайн: Hugging Face: LLM Course',
          start: '2027-02-16T00:00',
          end: '2027-02-16T00:00',
          description: '',
          availability: 'free',
          kind: 'milestone',
        },
      },
      { type: 'events.move', moves, reason: 'rebalance', calendar: 'hfllm' },
    ])
  },
}

/** The end of a lane dragged to 10 Feb: Re-balance opens for that calendar, aiming to finish by that day. */
export const FinishByFromTheTimeline: Story = {
  args: { preset: { calendar: 'hfllm', mode: 'rebalance', finishBy: '2027-02-10' } },
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    await waitFor(() =>
      expect(args.rebalance).toHaveBeenLastCalledWith(
        fixturePlan,
        expect.objectContaining({
          calendar: 'hfllm',
          from: FROM,
          deadline: '2027-02-11',
          target: { mode: 'deadline' },
        }),
      ),
    )
    await expect(body.getByRole('button', { name: m.reschedule_finish_by() })).toHaveAttribute('aria-pressed', 'true')
    const apply = body.getByRole('button', { name: m.reschedule_apply() })
    await waitFor(() => expect(apply).toBeEnabled())
    await userEvent.click(apply)
    await expect(args.onApply).toHaveBeenCalledWith([
      { type: 'events.move', moves, reason: 'rebalance', calendar: 'hfllm' },
    ])
  },
}

/** A lane dragged two weeks onto a rule: Move opens with that calendar and those days, ready to apply. */
export const MoveFromTheTimeline: Story = {
  args: { preset: { calendar: 'hfllm', mode: 'move', days: 14 } },
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    await userEvent.click(await body.findByRole('button', { name: m.reschedule_apply() }))
    await expect(args.onApply).toHaveBeenCalledWith([
      { type: 'events.shift', calendars: ['hfllm'], from: FROM, days: 14 },
    ])
  },
}

/** Only the deadline changes: Move stores it alone when nothing is shifted. */
export const DeadlineAlone: Story = {
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    await pick(canvasElement, 'hfllm')
    await fireEvent.change(body.getByLabelText(new RegExp(`^${m.reschedule_deadline()}`)), {
      target: { value: '2027-02-20' },
    })
    await fireEvent.change(body.getByLabelText(m.shift_days()), { target: { value: '0' } })
    const apply = body.getByRole('button', { name: m.reschedule_apply() })
    await waitFor(() => expect(apply).toBeEnabled())
    await userEvent.click(apply)
    await expect(args.onApply).toHaveBeenCalledWith([
      {
        type: 'event.add',
        event: {
          calendar: 'hfllm',
          title: 'Дедлайн: Hugging Face: LLM Course',
          start: '2027-02-20T00:00',
          end: '2027-02-20T00:00',
          description: '',
          availability: 'free',
          kind: 'milestone',
        },
      },
    ])
  },
}

/** Not everything finds room: the report says why, and nothing can be applied until it all fits. */
export const Shortfall: Story = {
  args: {
    rebalance: fn(async () =>
      result({
        unplaced: 3,
        reasons: [{ kind: 'full-weeks', from: '2027-01-11', to: '2027-02-07' }, { kind: 'limit' }],
      }),
    ),
  },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    await rebalanceLlm(canvasElement)
    const full = m.reschedule_reason_full_weeks({ from: fmtShort(day('2027-01-11')), to: fmtShort(day('2027-02-07')) })
    await expect(await body.findByText(full)).toBeVisible()
    await expect(body.getByText(m.reschedule_unplaced({ count: 3 }))).toBeVisible()
    await expect(body.getByRole('button', { name: m.reschedule_apply() })).toBeDisabled()
  },
}

/** A slow answer to an older request arrives after the answer to the newer one: the newer answer stays. */
export const OlderAnswerNeverWins: Story = {
  args: {
    rebalance: fn(async (_plan: Plan, request: RebalanceRequest) => {
      const older = request.target.mode === 'rhythm' && request.target.perDay === usual
      await pause(older ? 1200 : 50)
      return result({ finish: older ? '2027-03-10' : '2027-02-20' })
    }),
  },
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    await rebalanceLlm(canvasElement)
    await waitFor(() => expect(args.rebalance).toHaveBeenCalledTimes(1))
    await userEvent.click(body.getByRole('button', { name: RHYTHM_LABELS.get(other)?.() ?? '' }))
    await expect(await body.findByText(ends('2027-02-20'), {}, { timeout: 2000 })).toBeVisible()
    await pause(1400)
    await expect(body.getByText(ends('2027-02-20'))).toBeVisible()
    await expect(body.queryByText(ends('2027-03-10'))).toBeNull()
  },
}

/** A host that cannot re-balance offers only the move. */
export const WithoutRebalance: StoryObj<typeof RescheduleDialog> = {
  args: { rebalance: undefined },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    await body.findByRole('button', { name: m.reschedule_hour_later() })
    await expect(body.queryByRole('button', { name: m.reschedule_rebalance() })).toBeNull()
  },
}
