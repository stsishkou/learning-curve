import { m } from '@lc/i18n/messages'
import { isSession, MIN_LOGGED, parseLocal, type Plan } from '@lc/plan-domain'
import { fixtureBase, fixturePlan } from '@lc/plan-domain/fixtures'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within } from 'storybook/test'

import { CourseProgress } from './CourseProgress'

const meta = {
  title: 'Planner/Widgets/CourseProgress',
  component: CourseProgress,
  args: { plan: fixturePlan, onSelect: fn() },
  argTypes: { plan: { control: false } },
  decorators: [
    (Story) => (
      <div className="max-w-[360px] rounded-2xl border border-line bg-surface p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CourseProgress>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** A freshly generated plan: every ring is empty and each course points at its first session. */
export const NothingDone: Story = { args: { plan: fixtureBase } }

/** The fixture with the first `count` done sessions logged at their plan. */
const loggedFirst = (count: number): Plan => {
  let i = 0
  return {
    ...fixturePlan,
    events: fixturePlan.events.map((e) =>
      e.done && isSession(e) && i++ < count ? { ...e, actual: (parseLocal(e.end) - parseLocal(e.start)) / 60_000 } : e,
    ),
  }
}

/** Fewer logged sessions than a pace needs: the course says how many there are instead of showing the plan's pace. */
export const LearningThePace: Story = {
  args: { plan: loggedFirst(MIN_LOGGED - 2) },
  play: async ({ canvasElement }) => {
    const note = m.pace_wait_n({ min: MIN_LOGGED, count: MIN_LOGGED - 2 })
    await expect(within(canvasElement).getByText(note)).toBeVisible()
  },
}
