import { fixtureNow, fixturePlan } from '@lc/plan-domain/fixtures'
import type { Meta, StoryObj } from '@storybook/react-vite'

import { CourseBars } from './CourseBars'

const meta = {
  title: 'Dashboard/Widgets/CourseBars',
  component: CourseBars,
  args: { plan: fixturePlan, now: fixtureNow },
  argTypes: { plan: { control: false } },
} satisfies Meta<typeof CourseBars>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
