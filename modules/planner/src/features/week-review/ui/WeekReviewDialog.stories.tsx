import { DAY } from '@lc/plan-domain'
import { fixtureNow, fixturePlan, fixtureWeek } from '@lc/plan-domain/fixtures'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { WeekReviewDialog } from './WeekReviewDialog'

const meta = {
  title: 'Planner/Features/WeekReviewDialog',
  component: WeekReviewDialog,
  parameters: { dialog: true, docs: { story: { inline: false, iframeHeight: 620 } } },
  args: {
    plan: fixturePlan,
    monday: fixtureWeek,
    now: fixtureNow,
    onCatchUp: fn(),
    onNextWeek: fn(),
    onClose: fn(),
  },
  argTypes: { plan: { control: false } },
} satisfies Meta<typeof WeekReviewDialog>

export default meta
type Story = StoryObj<typeof meta>

/** The fixture's week in progress: part of it is done, nothing is missed yet. */
export const WeekInProgress: Story = {}

/** The same week looked at a week later: what was not done by then counts as missed and can be caught up. */
export const WithMissedSessions: Story = { args: { now: fixtureNow + 7 * DAY } }
