import { isSession } from '@lc/plan-domain'
import { fixtureNow, fixturePlan, itemAt } from '@lc/plan-domain/fixtures'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'

import { FocusPage } from './FocusPage'

const meta = {
  title: 'Planner/Page/FocusPage',
  component: FocusPage,
  parameters: { layout: 'fullscreen' },
  args: { plan: fixturePlan, canEdit: true, now: fixtureNow, onChange: fn(async () => {}) },
  argTypes: { plan: { control: false } },
} satisfies Meta<typeof FocusPage>

// The stand runs every story in Russian too.
const START = /Start|Resume|Начать|Продолжить/
const PAUSE = /Pause|Пауза/
const FINISH = /Finish|Готово/
const TAKE_BREAK = /Take a break|Сделать перерыв/
const BACK_TO_WORK = /Back to work|Вернуться к работе/

const open = itemAt(fixturePlan.events.filter((e) => isSession(e) && !e.done))

export default meta
type Story = StoryObj<typeof meta>

/**
 * The session in progress, or the next one that is not done, with a stopwatch. `Start` runs it, `Finish` sends one
 * `event.patch` that marks the session done and logs the time in quarter-hour steps.
 */
export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: START }))
    await expect(canvas.getByRole('button', { name: PAUSE })).toBeVisible()
    // A stopwatch that has counted nothing has nothing to log.
    await new Promise<void>((resolve) => setTimeout(() => resolve(), 20))
    await userEvent.click(canvas.getByRole('button', { name: PAUSE }))
    await userEvent.click(canvas.getByRole('button', { name: FINISH }))
    await expect(args.onChange).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'event.patch', patch: { done: true, actual: 15 } }),
    )
  },
}

/** On a read-only host the time can be measured but not logged: there is no `Finish`. */
export const ReadOnly: Story = { args: { canEdit: false } }

/**
 * With breaks of 25 + 5 minutes, 26 minutes in: the break is due. Taking it pauses the stopwatch and counts the rest
 * down; going back to work before it ends runs the stopwatch again.
 */
export const Breaks: Story = {
  args: { session: open.uid },
  beforeEach: () => {
    localStorage.setItem(
      'learning-curve:focus',
      JSON.stringify({ uid: open.uid, banked: 26 * 60_000, startedAt: null }),
    )
    localStorage.setItem('learning-curve:focus-breaks', 'short')
    return () => {
      localStorage.removeItem('learning-curve:focus')
      localStorage.removeItem('learning-curve:focus-breaks')
    }
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: TAKE_BREAK }))
    await expect(canvas.getByText(/Break: 0?5:00|Перерыв: осталось 0?5:00|0?4:5\d/)).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: BACK_TO_WORK }))
    await expect(canvas.getByRole('button', { name: PAUSE })).toBeVisible()
    await expect(canvas.queryByRole('button', { name: TAKE_BREAK })).toBeNull()
  },
}
