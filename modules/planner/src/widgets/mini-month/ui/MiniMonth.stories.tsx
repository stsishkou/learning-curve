import { DAY } from '@lc/plan-domain'
import { fixtureNow, fixturePlan, fixtureWeek } from '@lc/plan-domain/fixtures'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'

import { MiniMonth } from './MiniMonth'

const meta = {
  title: 'Planner/Widgets/MiniMonth',
  component: MiniMonth,
  args: {
    plan: fixturePlan,
    hidden: new Set<string>(),
    now: fixtureNow,
    shown: { start: fixtureWeek, days: 7 },
    onPickDay: fn(),
    onPickWeek: fn(),
  },
  argTypes: { plan: { control: false }, hidden: { control: false } },
  decorators: [(Story) => <div className="w-[248px]">{Story()}</div>],
} satisfies Meta<typeof MiniMonth>

export default meta
type Story = StoryObj<typeof meta>

/** The week on screen is marked; the first column is the ISO week number and opens that week. */
export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getAllByRole('button', { name: /\d+$/ })[0])
    await expect(args.onPickWeek).toHaveBeenCalled()
  },
}

/** The day view marks its one day. */
export const OneDay: Story = { args: { shown: { start: fixtureWeek + 2 * DAY, days: 1 } } }
