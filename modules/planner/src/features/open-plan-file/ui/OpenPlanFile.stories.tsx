import { fixturePlan } from '@lc/plan-domain/fixtures'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { OpenPlanFile } from './OpenPlanFile'

const meta = {
  title: 'Planner/Features/OpenPlanFile',
  component: OpenPlanFile,
  parameters: { docs: { story: { inline: false, iframeHeight: 720 } } },
  args: { shown: { name: 'plan.json', plan: fixturePlan }, project: fixturePlan, onOpen: fn() },
  argTypes: { shown: { control: false }, project: { control: false } },
} satisfies Meta<typeof OpenPlanFile>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
