import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fireEvent, fn, userEvent, within } from 'storybook/test'

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

/**
 * The Enter that picks a candidate of an input method (Japanese, Chinese) belongs to the text: it neither sends the
 * name nor, as Escape, drops it. Safari marks that Enter only with key code 229.
 */
export const InputMethod: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button'))
    const field = canvas.getByRole('textbox')
    await userEvent.type(field, 'エージェント')
    await fireEvent.keyDown(field, { key: 'Enter', isComposing: true })
    await fireEvent.keyDown(field, { key: 'Enter', keyCode: 229 })
    await fireEvent.keyDown(field, { key: 'Escape', isComposing: true })
    await expect(args.onRename).not.toHaveBeenCalled()
    await expect(field).toBeInTheDocument()
  },
}

/** Without `onRename` the name is a plain heading. */
export const ReadOnly: StoryObj<typeof PlanTitle> = { args: { onRename: undefined } }

/** In a row that takes it at its own width, as the plan page's heading row does, the name is shown whole. */
export const InARow: Story = {
  render: (args) => (
    <div className="flex items-center gap-3">
      <PlanTitle {...args} />
      <p>55 events</p>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const name = within(canvasElement).getByText('AI Agent Engineer')
    await expect(name.scrollWidth).toBeLessThanOrEqual(name.clientWidth)
  },
}
