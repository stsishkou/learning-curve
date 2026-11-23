import { isSession, parseLocal, type PlanEvent } from '@lc/plan-domain'
import { fixtureNow, fixturePlan, itemAt } from '@lc/plan-domain/fixtures'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within } from 'storybook/test'

import { EventDialog } from './EventDialog'

const pick = (test: (e: PlanEvent) => boolean) => fixturePlan.events.find(test) ?? itemAt(fixturePlan.events)
const upcoming = pick((e) => isSession(e) && parseLocal(e.start) > fixtureNow)

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
    onChange: fn(async () => {}),
    onClose: fn(),
    onDayChange: fn(),
  },
  argTypes: { plan: { control: false }, event: { control: false }, draft: { control: false } },
} satisfies Meta<typeof EventDialog>

export default meta
type Story = StoryObj<typeof meta>

/** A study session that has not started yet. */
export const Session: Story = {}

/** Marked done and changed by hand: the dialog offers to take both back. */
export const DoneAndEdited: Story = { args: { event: pick((e) => Boolean(e.done)), edited: true } }

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
    await expect(await body.findByText(new RegExp(upcoming.title.slice(0, 12)))).toBeVisible()
  },
}

/** The host rejects every change: press any button that edits to see the reason in the dialog. */
export const SaveFails: Story = {
  args: { onChange: fn(async () => Promise.reject(new Error('The plan is read-only on this host'))) },
}
