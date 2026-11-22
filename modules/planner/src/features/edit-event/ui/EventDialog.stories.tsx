import { isSession, parseLocal, type PlanEvent } from '@lc/plan-domain'
import { fixtureNow, fixturePlan } from '@lc/plan-domain/fixtures'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { EventDialog } from './EventDialog'

const pick = (test: (e: PlanEvent) => boolean) => fixturePlan.events.find(test) ?? fixturePlan.events[0]
const upcoming = pick((e) => isSession(e) && parseLocal(e.start) > fixtureNow)

const meta = {
  title: 'Planner/Features/EventDialog',
  component: EventDialog,
  parameters: {
    // Known findings in the component, not the story: the green "done" text (color-contrast).
    // `todo` keeps them in the panel and reports them as warnings instead of failing the test run.
    a11y: { test: 'todo' },
    docs: {
      description: {
        component:
          'One event: what it is, and for an editable plan every way to change it. It is open while it has an `event` or a `draft`; with a `draft` it starts as the form for a new event. Each button sends one `PlanChange` through `onChange`.',
      },
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

export const Session: Story = {}

export const DoneAndEdited: Story = { args: { event: pick((e) => !!e.done), edited: true } }

export const ReadOnly: Story = { args: { canEdit: false } }

export const Repeating: Story = { args: { event: pick((e) => !!e.rrule), day: '2026-12-03' } }

export const AllDay: Story = { args: { event: pick((e) => !!e.allDay) } }

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

export const SaveFails: Story = {
  args: { onChange: fn(async () => Promise.reject(new Error('The plan is read-only on this host'))) },
}
