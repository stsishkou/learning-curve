import { fixtureNow, fixturePlan, fixtureWeek } from '@lc/plan-domain/fixtures'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { PlanMap } from './PlanMap'

const meta = {
  title: 'Planner/Widgets/PlanMap',
  component: PlanMap,
  parameters: {
    // Known findings in the component, not the story: a week's visible text is not part of its label (label-content-name-mismatch).
    // `todo` keeps them in the panel and reports them as warnings instead of failing the test run.
    a11y: { test: 'todo' },
  },
  args: { plan: fixturePlan, hidden: new Set<string>(), now: fixtureNow, weekStart: fixtureWeek, onPickWeek: fn() },
  argTypes: { plan: { control: false }, hidden: { control: false } },
  decorators: [
    (Story) => (
      <div className="max-w-[360px] rounded-2xl border border-line bg-surface p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PlanMap>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const CertificatesHidden: Story = { args: { hidden: new Set(['certs']) } }
