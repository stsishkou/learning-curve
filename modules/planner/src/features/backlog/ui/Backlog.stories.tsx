import { isSession, parseLocal } from '@lc/plan-domain'
import { fixtureNow, fixturePlan, itemAt } from '@lc/plan-domain/fixtures'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fireEvent, fn, userEvent, within } from 'storybook/test'

import { Backlog } from './Backlog'

// The fixture has nothing missed: a few sessions before its present are taken as not done.
const missed = fixturePlan.events
  .filter((e) => isSession(e) && parseLocal(e.end) < fixtureNow)
  .slice(-4)
  .map((e) => ({ ...e, done: false }))
const first = itemAt(missed)

const meta = {
  title: 'Planner/Features/Backlog',
  component: Backlog,
  args: { plan: fixturePlan, events: missed, onSelect: fn(), onCarry: fn() },
  argTypes: { plan: { control: false }, events: { control: false } },
} satisfies Meta<typeof Backlog>

export default meta
type Story = StoryObj<typeof meta>

/** A chip opens its session on a click, and hands it to the grid when it is picked up and let go. */
export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const chip = within(canvasElement).getByTitle(first.title)
    await userEvent.click(chip)
    await expect(args.onSelect).toHaveBeenCalledWith(first)
    await fireEvent.dragStart(chip, { dataTransfer: new DataTransfer() })
    await expect(args.onCarry).toHaveBeenLastCalledWith(first)
    await fireEvent.dragEnd(chip)
    await expect(args.onCarry).toHaveBeenLastCalledWith(null)
  },
}

/** Nothing missed, nothing shown. */
export const Empty: Story = {
  args: { events: [] },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('button')).toBeNull()
  },
}
