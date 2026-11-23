import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'

import { PlanTitle } from './PlanTitle'

const meta = {
  title: 'Planner/Features/PlanTitle',
  component: PlanTitle,
  args: { title: 'AI Agent Engineer', onRename: fn() },
} satisfies Meta<typeof PlanTitle>

export default meta
type Story = StoryObj<typeof meta>

/** A click on the name turns it into a field; Enter sends the new name, Escape keeps the old one. */
export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button'))
    const field = canvas.getByRole('textbox')
    await userEvent.clear(field)
    await userEvent.type(field, 'Agent Engineer 2027{Enter}')
    await expect(args.onRename).toHaveBeenCalledWith('Agent Engineer 2027')
  },
}

/** Without `onRename` the name is a plain heading. */
export const ReadOnly: StoryObj<typeof PlanTitle> = { args: { onRename: undefined } }
