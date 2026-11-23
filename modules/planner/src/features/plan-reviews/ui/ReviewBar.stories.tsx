import { itemAt } from '@lc/plan-domain/fixtures'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'

import { ReviewBar } from './ReviewBar'

const review = (start: string, n: number) => ({
  calendar: 'certs',
  title: `GE Agent Dev — Повтор: ADK: агенты, инструменты, runner (${n}/3)`,
  description: '',
  start,
  end: start.replace(':00', ':30'),
  availability: 'busy' as const,
})

const meta = {
  title: 'Planner/Features/ReviewBar',
  component: ReviewBar,
  args: {
    offer: {
      key: 'certs\nGE Agent Dev — ADK: агенты, инструменты, runner',
      calendar: 'certs',
      title: 'ADK: агенты, инструменты, runner',
      reviews: [review('2026-11-26T14:00', 1), review('2026-11-28T13:00', 2), review('2026-12-02T14:00', 3)],
    },
    more: 0,
    onPlan: fn(),
    onDismiss: fn(),
  },
} satisfies Meta<typeof ReviewBar>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Shown once every session of a module is done: reviews one, three and seven days later, each in the first free
 * half hour of its day. The page sends them as one `reviews.plan` change.
 */
export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(itemAt(within(canvasElement).getAllByRole('button')))
    await expect(args.onPlan).toHaveBeenCalled()
  },
}

/** Other finished modules wait their turn: the bar offers one at a time. */
export const MoreWaiting: Story = { args: { more: 2 } }
