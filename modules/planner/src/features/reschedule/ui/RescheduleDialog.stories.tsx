import { fmtDay, fmtShort } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import {
  DAY,
  isSession,
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

/** One calendar, then the Re-balance mode: the dialog asks for an answer at the default pace. */
async function rebalanceLlm(canvasElement: HTMLElement) {
  const body = within(canvasElement.ownerDocument.body)
  const calendar = await body.findByRole('combobox', { name: new RegExp(`^${m.field_calendar()}`) })
  await userEvent.selectOptions(calendar, 'hfllm')
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

/** Every open session from the chosen day moves by the same days and hours, in every calendar or in one. */
export const Default: Story = {}

/** Studying an hour later: a shift by hours alone, with no days in it. */
export const MoveByAnHour: Story = {
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    await userEvent.click(await body.findByRole('button', { name: m.reschedule_hour_later() }))
    await userEvent.click(body.getByRole('button', { name: m.reschedule_apply() }))
    await expect(args.onApply).toHaveBeenCalledWith([
      { type: 'events.shift', calendar: undefined, from: FROM, hours: 1 },
    ])
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
    await userEvent.selectOptions(
      await body.findByRole('combobox', { name: new RegExp(`^${m.field_calendar()}`) }),
      'hfllm',
    )
    await userEvent.click(body.getByRole('button', { name: m.reschedule_hour_later() }))
    const overlap = m.ai_warn_overlap({ title: firstOpen?.title ?? '', other: 'Talk' })
    await waitFor(() => expect(body.getByText(overlap)).toBeVisible())
    await expect(args.onApply).not.toHaveBeenCalled()
  },
}

/** One every two days: the dialog asks for that pace and shows when the course ends then. */
export const RebalanceByPace: Story = {
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    await rebalanceLlm(canvasElement)
    await userEvent.click(body.getByRole('button', { name: m.reschedule_pace_1_2() }))
    await waitFor(() =>
      expect(args.rebalance).toHaveBeenLastCalledWith(
        fixturePlan,
        expect.objectContaining({ calendar: 'hfllm', from: FROM, target: { mode: 'pace', perDay: 0.5 } }),
      ),
    )
    await expect(await body.findByText(ends('2027-02-15'))).toBeVisible()
  },
}

/**
 * A deadline typed for a calendar that has none: the re-balance can aim at it at once, and Apply stores it as the
 * calendar's milestone before the moves.
 */
export const FitTheDeadline: Story = {
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    await rebalanceLlm(canvasElement)
    const fit = body.getByRole('checkbox', { name: m.reschedule_fit_deadline() })
    await expect(fit).toBeDisabled()
    await fireEvent.change(body.getByLabelText(new RegExp(`^${m.reschedule_deadline()}`)), {
      target: { value: '2027-02-16' },
    })
    await userEvent.click(fit)
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
      const older = request.target.mode === 'pace' && request.target.perDay === 1
      await pause(older ? 1200 : 50)
      return result({ finish: older ? '2027-03-10' : '2027-02-20' })
    }),
  },
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    await rebalanceLlm(canvasElement)
    await waitFor(() => expect(args.rebalance).toHaveBeenCalledTimes(1))
    await userEvent.click(body.getByRole('button', { name: m.reschedule_pace_1_2() }))
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
