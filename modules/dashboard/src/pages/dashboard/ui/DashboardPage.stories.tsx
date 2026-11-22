import { fixtureNow, fixturePlan } from '@lc/plan-domain/fixtures'
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
          'The progress page as the app renders it at `/dashboard`. The app leaves `now` out and the page follows the clock; the story pins it so the picture does not depend on the day it is opened.',
      },
    },
  },
  args: { plan: fixturePlan, now: fixtureNow },
  argTypes: { plan: { control: false }, headerAside: { control: false } },
} satisfies Meta<typeof DashboardPage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
