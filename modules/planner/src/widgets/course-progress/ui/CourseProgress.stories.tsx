import { buildPlan, DEFAULT_CONFIG } from '@lc/plan-domain'
import { fixturePlan } from '@lc/plan-domain/fixtures'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

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

export const NothingDone: Story = { args: { plan: buildPlan(DEFAULT_CONFIG, '2026-11-22') } }
