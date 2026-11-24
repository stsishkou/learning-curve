import { fixtureNow, fixturePlan } from '@lc/plan-domain/fixtures'
import type { Meta, StoryObj } from '@storybook/react-vite'

import { StudyStreak } from './StudyStreak'

const meta = {
  title: 'Dashboard/Widgets/StudyStreak',
  component: StudyStreak,
  args: { plan: fixturePlan, now: fixtureNow },
  argTypes: { plan: { control: false } },
} satisfies Meta<typeof StudyStreak>

export default meta
type Story = StoryObj<typeof meta>

/** Every session before the fixture's "now" is done: the run is as long as those study days. */
export const Default: Story = {}
