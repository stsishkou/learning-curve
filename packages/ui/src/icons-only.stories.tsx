import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'

import { Button } from './button'
import { Plus } from './icons'
import { IconsToggle } from './icons-only'
import { clearIconsOnly } from './testing'

const meta = {
  title: 'UI kit/IconsOnly',
  component: IconsToggle,
  args: { label: 'Icons only', hint: 'Buttons with an icon hide their word; it shows on hover' },
  beforeEach: () => {
    clearIconsOnly()
    return clearIconsOnly
  },
  render: (args) => (
    <div className="flex items-center gap-3 p-6">
      <IconsToggle {...args} />
      <Button icon={<Plus size={16} aria-hidden />} label="Event" data-tip="A new event at the next free hour" />
      <Button>Today</Button>
    </div>
  ),
} satisfies Meta<typeof IconsToggle>

export default meta
type Story = StoryObj<typeof meta>

const tip = () => document.querySelector<HTMLElement>('.lc-tip')
const wordOf = (button: HTMLElement) => within(button).getByText('Event')

/**
 * The switch hides the word of every button that has an icon; a button without one keeps its word. The word is
 * still the button's name for a screen reader, and the tooltip shows it, above what the button does.
 */
export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const event = canvas.getByRole('button', { name: 'Event' })
    const toggle = canvas.getByRole('button', { name: args.label })
    await expect(wordOf(event).getBoundingClientRect().width).toBeGreaterThan(10)
    await userEvent.click(toggle)
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')
    await expect(wordOf(event).getBoundingClientRect().width).toBeLessThanOrEqual(1)
    await expect(canvas.getByRole('button', { name: 'Event' })).toBeVisible()
    await expect(canvas.getByText('Today').getBoundingClientRect().width).toBeGreaterThan(10)
    await userEvent.hover(event)
    await waitFor(() => expect(tip()).toHaveTextContent('Event'))
    await expect(tip()).toHaveTextContent('A new event at the next free hour')
    await userEvent.click(toggle)
    await expect(toggle).toHaveAttribute('aria-pressed', 'false')
    await expect(wordOf(event).getBoundingClientRect().width).toBeGreaterThan(10)
  },
}

/** The choice is kept in the browser: the next visit opens with the words hidden. */
export const RememberedFromTheLastVisit: Story = {
  beforeEach: () => {
    localStorage.setItem('lc-icons-only', '1')
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: args.label })).toHaveAttribute('aria-pressed', 'true'),
    )
    await expect(
      wordOf(canvas.getByRole('button', { name: 'Event' })).getBoundingClientRect().width,
    ).toBeLessThanOrEqual(1)
  },
}

/** A button at the far end of a row that scrolls sideways keeps its hidden word inside the row: the page stays as wide as the window. */
export const AtTheEndOfAScrollingRow: Story = {
  beforeEach: () => {
    localStorage.setItem('lc-icons-only', '1')
  },
  render: (args) => (
    <div className="flex items-center gap-3 p-6">
      <IconsToggle {...args} />
      <div className="flex w-[300px] items-center gap-2 overflow-x-auto">
        <div className="h-8 w-[2000px] flex-none" />
        <Button icon={<Plus size={16} aria-hidden />} label="Calendars" />
      </div>
    </div>
  ),
  play: async ({ canvasElement, args }) => {
    await waitFor(() =>
      expect(within(canvasElement).getByRole('button', { name: args.label })).toHaveAttribute('aria-pressed', 'true'),
    )
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
  },
}

/** With the words shown, a button's tooltip says only what it does: its name is already there to read. */
export const WordsShown: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.hover(within(canvasElement).getByRole('button', { name: 'Event' }))
    await waitFor(() => expect(tip()).toHaveTextContent('A new event at the next free hour'))
    await expect(tip()?.textContent.startsWith('Event')).toBe(false)
  },
}
