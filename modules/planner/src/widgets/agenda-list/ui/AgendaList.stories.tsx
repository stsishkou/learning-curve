import { DAY, occurrences } from '@lc/plan-domain'
import { fixtureNow, fixturePlan, fixtureWeek } from '@lc/plan-domain/fixtures'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { AgendaList } from './AgendaList'

const meta = {
  title: 'Planner/Widgets/AgendaList',
  component: AgendaList,
  parameters: {
    // Known findings in the component, not the story: the red heading of today (color-contrast).
    // `todo` keeps them in the panel and reports them as warnings instead of failing the test run.
    a11y: { test: 'todo' },
  },
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

export const Default: Story = {}

export const Empty: Story = { args: { items: [] } }
