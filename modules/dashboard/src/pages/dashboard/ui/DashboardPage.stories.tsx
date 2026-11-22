import { fixturePlan } from '@lc/plan-domain/fixtures'
import type { Meta, StoryObj } from '@storybook/react-vite'

import { DashboardPage } from './DashboardPage'

const meta = {
  title: 'Dashboard/Page/DashboardPage',
  component: DashboardPage,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The progress page as the app renders it at `/dashboard`. It uses the real clock, so the "today" marker and the pace depend on the day it is opened.',
      },
    },
  },
  args: { plan: fixturePlan },
  argTypes: { plan: { control: false }, headerAside: { control: false } },
} satisfies Meta<typeof DashboardPage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
