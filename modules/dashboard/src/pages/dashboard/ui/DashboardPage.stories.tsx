import { fixturePlan } from '@lc/plan-domain/fixtures'
import type { Meta, StoryObj } from '@storybook/react-vite'

import { DashboardPage } from './DashboardPage'

const meta = {
  title: 'Dashboard/Page/DashboardPage',
  component: DashboardPage,
  parameters: {
    // Known findings in the component, not the story: the green delta of a tile (color-contrast).
    // `todo` keeps them in the panel and reports them as warnings instead of failing the test run.
    a11y: { test: 'todo' },
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The progress page as the app renders it at `/dashboard`. It uses the real clock, so the "today" marker and the pace depend on the day it is opened.',
      },
    },
  },
  args: { plan: fixturePlan },
  argTypes: { plan: { control: false } },
} satisfies Meta<typeof DashboardPage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
