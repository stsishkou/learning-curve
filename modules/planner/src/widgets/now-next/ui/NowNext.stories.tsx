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

/** The fixed "now" falls inside a session: the card counts down to its end. */
export const SessionRunning: Story = {}

/** Nine in the morning of the same day: the card counts down to the start of the next session. */
export const BeforeTheFirstSession: Story = { args: { now: today + 9 * HOUR } }

/** With nothing ahead only the heading is left. */
export const NothingAhead: Story = { args: { upcoming: [] } }
