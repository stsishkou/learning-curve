import { DAY, occurrences } from '@lc/plan-domain'
import { fixtureNow, fixturePlan, fixtureWeek } from '@lc/plan-domain/fixtures'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { AgendaList } from './AgendaList'

const meta = {
  title: 'Planner/Widgets/AgendaList',
  component: AgendaList,
  args: {
    plan: fixturePlan,
    items: occurrences(fixturePlan, fixtureWeek - 7 * DAY, fixtureWeek + 21 * DAY, new Set()),
    now: fixtureNow,
    onSelect: fn(),
  },
  argTypes: { plan: { control: false }, items: { control: false } },
} satisfies Meta<typeof AgendaList>

export default meta
type Story = StoryObj<typeof meta>

/** Four weeks around the fixed "now": the list opens scrolled to today's heading. */
export const Default: Story = {}

export const Empty: Story = { args: { items: [] } }
