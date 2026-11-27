import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'

import { Settings } from './icons'
import { Popover } from './popover'
import { Segmented } from './segmented'

const guide = fn()

function Display() {
  const [size, setSize] = useState<'s' | 'l'>('s')
  const [hints, setHints] = useState(false)
  return (
    <div className="grid gap-2 text-[13.5px]">
      <Segmented
        label="Text size"
        value={size}
        options={[
          { value: 's', label: 'Small' },
          { value: 'l', label: 'Large' },
        ]}
        onChange={setSize}
      />
      <button type="button" aria-pressed={hints} onClick={() => setHints(!hints)}>
        Hints
      </button>
      <button type="button" onClick={guide}>
        Guide
      </button>
    </div>
  )
}

const meta = {
  title: 'UI kit/Popover',
  component: Popover,
  parameters: { layout: 'centered', docs: { story: { inline: false, iframeHeight: 260 } } },
  args: { label: 'Display', icon: <Settings size={17} aria-hidden />, children: null },
  render: (args) => (
    <Popover {...args}>
      <Display />
    </Popover>
  ),
} satisfies Meta<typeof Popover>

export default meta
type Story = StoryObj<typeof meta>

const parts = (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement)
  return { canvas, trigger: canvas.getByRole('button', { name: 'Display' }) }
}

/** A button that opens a small panel of controls under itself, with the focus on the first of them. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const { canvas, trigger } = parts(canvasElement)
    await userEvent.click(trigger)
    await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'true'))
    await waitFor(() => expect(canvas.getByRole('dialog', { name: 'Display' })).toBeVisible())
    await waitFor(() => expect(canvas.getByRole('button', { name: 'Small' })).toHaveFocus())
  },
}

/** A choice or a switch changes in place and leaves the panel open, so the next one is a press away. */
export const SwitchesKeepItOpen: Story = {
  play: async ({ canvasElement }) => {
    const { canvas, trigger } = parts(canvasElement)
    await userEvent.click(trigger)
    await userEvent.click(canvas.getByRole('button', { name: 'Large' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Hints' }))
    await expect(canvas.getByRole('button', { name: 'Hints' })).toHaveAttribute('aria-pressed', 'true')
    await expect(trigger).toHaveAttribute('aria-expanded', 'true')
  },
}

/** A button that goes somewhere else closes it, as a menu item does. */
export const ActionClosesIt: Story = {
  play: async ({ canvasElement }) => {
    const { canvas, trigger } = parts(canvasElement)
    await userEvent.click(trigger)
    await userEvent.click(canvas.getByRole('button', { name: 'Guide' }))
    await expect(guide).toHaveBeenCalled()
    await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'false'))
  },
}

/** Tab past its last control closes it: the panel does not hold the focus. */
export const TabLeaves: Story = {
  play: async ({ canvasElement }) => {
    const { canvas, trigger } = parts(canvasElement)
    await userEvent.click(trigger)
    await waitFor(() => expect(canvas.getByRole('button', { name: 'Small' })).toHaveFocus())
    // Large, Hints, Guide, then out.
    await userEvent.tab()
    await userEvent.tab()
    await userEvent.tab()
    await userEvent.tab()
    await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'false'))
  },
}
