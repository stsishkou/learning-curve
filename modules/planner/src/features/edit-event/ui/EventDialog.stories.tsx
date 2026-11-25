import { fmtDuration } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import { isSession, parseLocal, splitInHalves, type PlanChange, type PlanEvent } from '@lc/plan-domain'
import { fixtureNow, fixturePlan, itemAt } from '@lc/plan-domain/fixtures'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'

import { EventDialog } from './EventDialog'

const pick = (test: (e: PlanEvent) => boolean) => fixturePlan.events.find(test) ?? itemAt(fixturePlan.events)
const upcoming = pick((e) => isSession(e) && parseLocal(e.start) > fixtureNow)
const finished = pick((e) => isSession(e) && Boolean(e.done) && e.actual === undefined)
const MINUTE = 60_000
const plannedOf = (e: PlanEvent) => Math.round((parseLocal(e.end) - parseLocal(e.start)) / MINUTE)

const meta = {
  title: 'Planner/Features/EventDialog',
  component: EventDialog,
  parameters: {
    dialog: true,
    docs: {
      story: { inline: false, iframeHeight: 560 },
    },
  },
  args: {
    plan: fixturePlan,
    event: upcoming,
    draft: null,
    edited: false,
    canEdit: true,
    onChange: fn(async (_change: PlanChange) => {}),
    onClose: fn(),
    onDayChange: fn(),
  },
  argTypes: { plan: { control: false }, event: { control: false }, draft: { control: false } },
} satisfies Meta<typeof EventDialog>

export default meta
type Story = StoryObj<typeof meta>

/** A study session that has not started yet. */
export const Session: Story = {}

/** Mark done asks how long the session took: one choice marks it done with that time. */
export const MarkDone: Story = {
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    await userEvent.click(await body.findByRole('button', { name: m.mark_done() }))
    await expect(args.onChange).not.toHaveBeenCalled()
    await userEvent.click(body.getByRole('button', { name: m.spent_over_plan({ time: fmtDuration(15 * MINUTE) }) }))
    await expect(args.onChange).toHaveBeenCalledWith({
      type: 'event.patch',
      uid: upcoming.uid,
      patch: { done: true, actual: plannedOf(upcoming) + 15 },
    })
  },
}

/** A session can still be marked done without a time, but only as a choice of its own. */
export const MarkDoneWithoutTime: Story = {
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    await userEvent.click(await body.findByRole('button', { name: m.mark_done() }))
    await userEvent.click(body.getByRole('button', { name: m.spent_done_without() }))
    await expect(args.onChange).toHaveBeenCalledWith({ type: 'event.patch', uid: upcoming.uid, patch: { done: true } })
  },
}

/** Marked done and changed by hand: the dialog offers to take both back. */
export const DoneAndEdited: Story = { args: { event: pick((e) => Boolean(e.done)), edited: true } }

/**
 * Marked done without a time, as the bulk actions and tools do: the card says the time is not logged instead of
 * showing the plan as the time spent, and one choice logs it.
 */
export const DoneNotLogged: Story = {
  args: { event: finished },
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    const missing = await body.findByText(m.spent_not_logged())
    await waitFor(() => expect(missing).toBeVisible())
    await userEvent.click(body.getByRole('button', { name: m.spent_as_planned() }))
    await expect(args.onChange).toHaveBeenCalledWith({
      type: 'event.patch',
      uid: finished.uid,
      patch: { actual: plannedOf(finished) },
    })
    await userEvent.click(body.getByRole('button', { name: m.spent_over_plan({ time: fmtDuration(30 * MINUTE) }) }))
    await expect(args.onChange).toHaveBeenCalledWith({
      type: 'event.patch',
      uid: finished.uid,
      patch: { actual: plannedOf(finished) + 30 },
    })
  },
}

/** A logged time is shown as it was logged, and steps by a quarter hour from there. */
export const DoneLogged: Story = {
  args: { event: { ...finished, actual: 75 } },
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    const logged = await body.findByText(fmtDuration(75 * MINUTE))
    await waitFor(() => expect(logged).toBeVisible())
    await userEvent.click(body.getByRole('button', { name: m.spent_more() }))
    await expect(args.onChange).toHaveBeenCalledWith({ type: 'event.patch', uid: finished.uid, patch: { actual: 90 } })
  },
}

/** A time the stopwatch measured says so, with when it started and how long it stood paused. */
export const DoneMeasured: Story = {
  args: {
    event: { ...finished, actual: 52, measured: true, began: `${finished.start.slice(0, 10)}T14:03`, paused: 8 },
  },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    const record = `${m.spent_measured({ time: '14:03' })} · ${m.spent_paused({ time: fmtDuration(8 * MINUTE) })}`
    await waitFor(() => expect(body.getByText(record)).toBeVisible())
  },
}

/** A done session whose goal was not met says so: the rest of the module goes on in a later session. */
export const Unfinished: Story = {
  args: { event: { ...finished, actual: 75 } },
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    await userEvent.click(await body.findByRole('checkbox', { name: m.unfinished_label() }))
    await expect(args.onChange).toHaveBeenCalledWith({
      type: 'event.patch',
      uid: finished.uid,
      patch: { unfinished: true },
    })
  },
}

/** Once a session is marked unfinished, the card offers a session of the same module in the next free slot. */
export const UnfinishedAddsSession: Story = {
  args: { event: { ...finished, actual: 75, unfinished: true } },
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    await userEvent.click(await body.findByRole('button', { name: m.unfinished_add() }))
    const change = args.onChange.mock.lastCall?.[0]
    await expect(change).toMatchObject({
      type: 'event.add',
      event: { calendar: finished.calendar, title: finished.title },
    })
  },
}

export const ReadOnly: Story = { args: { canEdit: false } }

/** One repeat of a weekly event, opened on the day given in `day`. */
export const Repeating: Story = { args: { event: pick((e) => Boolean(e.rrule)), day: '2026-12-03' } }

export const AllDay: Story = { args: { event: pick((e) => Boolean(e.allDay)) } }

/** A `draft` and no `event`: the dialog starts as the form, filled with the draft. */
export const NewEvent: Story = {
  args: {
    event: null,
    draft: {
      calendar: 'pypy',
      title: '',
      start: '2026-12-04T15:00',
      end: '2026-12-04T16:00',
      description: '',
      availability: 'busy',
    },
  },
}

/**
 * A new event on a slot that is taken: the form names what is planned for the same time. It is a warning, the
 * event can still be saved. The card of a stored event shows the same line.
 */
export const Overlapping: Story = {
  args: {
    event: null,
    draft: {
      calendar: 'pypy',
      title: 'Dentist',
      start: upcoming.start,
      end: upcoming.end,
      description: '',
      availability: 'busy',
    },
  },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    const other = await body.findByText(new RegExp(upcoming.title.slice(0, 12)))
    // The dialog fades in: it is visible once its opening transition has begun.
    await waitFor(() => expect(other).toBeVisible())
  },
}

/** The host rejects every change: press any button that edits to see the reason in the dialog. */
export const SaveFails: Story = {
  args: {
    onChange: fn(async (_change: PlanChange) => Promise.reject(new Error('The plan is read-only on this host'))),
  },
}

/**
 * A session of an hour or more can be split in two from its card: the halves fall on the half hour, the second
 * right after the first, and the dialog closes so it can be dragged elsewhere. Labs stay one block.
 */
export const Split: Story = {
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    const split = await body.findByRole('button', { name: /✂|split|раздел|divid/i })
    await userEvent.click(split)
    await expect(args.onChange).toHaveBeenCalledWith(splitInHalves(upcoming))
  },
}
