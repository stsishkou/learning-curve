import { fixtureNow, fixturePlan } from '@lc/plan-domain/fixtures'
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
