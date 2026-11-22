import { DAY, HOUR, occurrences, startOfDay } from '@lc/plan-domain'
import { fixtureNow, fixturePlan } from '@lc/plan-domain/fixtures'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { NowNext } from './NowNext'

const today = startOfDay(fixtureNow)
const upcoming = occurrences(fixturePlan, today, today + 21 * DAY, new Set()).filter((o) => !o.allDay)

const meta = {
  title: 'Planner/Widgets/NowNext',
  component: NowNext,
  args: { plan: fixturePlan, upcoming, now: fixtureNow, onSelect: fn() },
  argTypes: { plan: { control: false }, upcoming: { control: false } },
} satisfies Meta<typeof NowNext>

export default meta
type Story = StoryObj<typeof meta>

export const SessionRunning: Story = {}

export const BeforeTheFirstSession: Story = { args: { now: today + 9 * HOUR } }

export const NothingAhead: Story = { args: { upcoming: [] } }
