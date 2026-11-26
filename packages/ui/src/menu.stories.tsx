import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ComponentProps } from 'react'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'

import { Calendar, History, MoveHorizontal, Trash2 } from './icons'
import { Menu } from './menu'

function WithSwitch(props: ComponentProps<typeof Menu>) {
  const [wide, setWide] = useState(false)
  return (
    <Menu
      {...props}
      items={[...props.items, { id: 'wide', label: '24 hours', checked: wide, run: () => setWide(!wide) }]}
    />
  )
}

const history = fn()

const meta = {
  title: 'UI kit/Menu',
  component: Menu,
  parameters: {
    layout: 'centered',
    docs: {
      story: { inline: false, iframeHeight: 320 },
    },
  },
  args: {
    label: 'More actions',
    items: [
      { id: 'history', icon: <History size={16} aria-hidden />, label: 'History', badge: 4, keys: 'H', run: history },
      { id: 'trash', icon: <Trash2 size={16} aria-hidden />, label: 'Trash', badge: 2, run: fn() },
      { id: 'shift', icon: <MoveHorizontal size={16} aria-hidden />, label: 'Shift the plan', run: fn() },
      { id: 'locked', icon: <Calendar size={16} aria-hidden />, label: 'Calendars', disabled: true, run: fn() },
    ],
  },
} satisfies Meta<typeof Menu>

export default meta
type Story = StoryObj<typeof meta>

/** Opening the menu puts the focus on its first enabled row; running an item closes it. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole('button', { name: 'More actions' })
    await userEvent.click(trigger)
    await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'true'))
    const first = within(canvasElement).getByRole('menuitem', { name: /History/ })
    await waitFor(() => expect(first).toHaveFocus())
    await userEvent.click(first)
    await expect(history).toHaveBeenCalled()
    await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'false'))
  },
}

/** A switch row shows a check mark and leaves the menu open when it is toggled. */
export const WithToggle: Story = {
  render: (args) => <WithSwitch {...args} />,
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole('button', { name: 'More actions' })
    await userEvent.click(trigger)
    const toggle = within(canvasElement).getByRole('menuitemcheckbox', { name: '24 hours' })
    await userEvent.click(toggle)
    await expect(toggle).toHaveAttribute('aria-checked', 'true')
    await expect(trigger).toHaveAttribute('aria-expanded', 'true')
  },
}

/** A menu of its own in a toolbar shows its own icon instead of the `⋮`, and keeps its name. */
export const WithIcon: Story = {
  args: { label: 'Side panels', icon: <Calendar size={17} aria-hidden /> },
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole('button', { name: 'Side panels' })
    await expect(trigger.querySelector('.lucide-calendar')).not.toBeNull()
    await expect(trigger.querySelector('.lucide-ellipsis-vertical')).toBeNull()
  },
}
