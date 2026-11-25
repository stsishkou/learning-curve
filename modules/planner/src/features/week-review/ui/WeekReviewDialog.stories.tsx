import { m } from '@lc/i18n/messages'
import { DAY, MIN_LOGGED } from '@lc/plan-domain'
import { fixtureNow, fixturePlan, fixtureWeek } from '@lc/plan-domain/fixtures'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, waitFor, within } from 'storybook/test'

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

/**
 * The fixture's week in progress: part of it is done, nothing is missed yet. None of it is logged, so the week has
 * no pace yet and says from how many logged sessions it will.
 */
export const WeekInProgress: Story = {
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    const wait = m.dash_pace_wait({ count: MIN_LOGGED })
    // The note follows how much of the week is logged.
    await waitFor(() => expect(body.getByText((text) => text.endsWith(` · ${wait}`))).toBeVisible())
  },
}

/** The same week looked at a week later: what was not done by then counts as missed and can be caught up. */
export const WithMissedSessions: Story = { args: { now: fixtureNow + 7 * DAY } }
