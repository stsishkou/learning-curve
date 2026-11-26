import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'

import { Button } from './button'
import { Undo2 } from './icons'
import { Modal } from './modal'

const meta = {
  title: 'UI kit/Tooltip',
  render: () => (
    <div className="flex gap-3 p-6">
      <Button data-tip="Monday to Friday only">Work week</Button>
      <button
        type="button"
        className="grid size-9 place-items-center rounded-[10px] border border-line bg-surface"
        aria-label="Undo"
        data-tip="Undo"
      >
        <Undo2 size={17} aria-hidden />
      </button>
    </div>
  ),
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

// One tooltip serves the whole page: it lives in the top layer, outside the story.
const tip = () => document.querySelector<HTMLElement>('.lc-tip')
const shown = () => tip()?.matches(':popover-open') === true

/**
 * Anything with `data-tip` gets a tooltip a moment after the pointer rests on it, under it, and loses it when the
 * pointer leaves. It replaces the browser's own, which takes a second to come and never shows for the keyboard.
 */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Work week' })
    await userEvent.hover(button)
    await waitFor(() => expect(shown()).toBe(true), { timeout: 600 })
    await expect(tip()).toHaveTextContent('Monday to Friday only')
    await expect(tip()?.getBoundingClientRect().top).toBeGreaterThanOrEqual(button.getBoundingClientRect().bottom)
    await userEvent.unhover(button)
    await waitFor(() => expect(shown()).toBe(false))
  },
}

/** A control reached with the keyboard shows its tooltip at once; Esc puts it away. */
export const OnKeyboardFocus: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.tab()
    await userEvent.tab()
    await expect(within(canvasElement).getByRole('button', { name: 'Undo' })).toHaveFocus()
    await waitFor(() => expect(tip()).toHaveTextContent('Undo'))
    await expect(shown()).toBe(true)
    await userEvent.keyboard('{Escape}')
    await expect(shown()).toBe(false)
  },
}

/** Pressing a control with the keyboard puts its tooltip away: what it does may move the control or change it. */
export const HidesWhenPressed: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.tab()
    await expect(within(canvasElement).getByRole('button', { name: 'Work week' })).toHaveFocus()
    await waitFor(() => expect(shown()).toBe(true))
    await userEvent.keyboard('{Enter}')
    await expect(shown()).toBe(false)
  },
}

/** A tooltip shows above an open dialog too, for the buttons inside it. */
export const InADialog: Story = {
  render: () => (
    <Modal open onClose={() => undefined}>
      <Button data-tip="Removes the event and every one of its repeats">Delete</Button>
    </Modal>
  ),
  play: async () => {
    const dialog = within(document.body).getByRole('dialog')
    await userEvent.hover(within(dialog).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(shown()).toBe(true), { timeout: 600 })
    await expect(tip()?.checkVisibility()).toBe(true)
  },
}
