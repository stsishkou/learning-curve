import { fixturePlan } from '@lc/plan-domain/fixtures'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ComponentProps } from 'react'
import { expect, fn, userEvent, within } from 'storybook/test'

import { CalendarFilter } from './CalendarFilter'

/** Keeps the hidden set the way the page does with `useHiddenCalendars`, without the browser storage. */
function Stateful(props: ComponentProps<typeof CalendarFilter>) {
  const [hidden, setHidden] = useState(props.hidden)
  const toggle = (id: string) => {
    const next = new Set(hidden)
    if (!next.delete(id)) next.add(id)
    setHidden(next)
    props.onToggle(id)
  }
  const solo = (id: string) => {
    const others = props.calendars.filter((c) => c.id !== id).map((c) => c.id)
    const alreadySolo = !hidden.has(id) && others.every((other) => hidden.has(other))
    setHidden(new Set(alreadySolo ? [] : others))
    props.onSolo(id)
  }
  return <CalendarFilter {...props} hidden={hidden} onToggle={toggle} onSolo={solo} />
}

const meta = {
  title: 'Planner/Features/CalendarFilter',
  component: CalendarFilter,
  args: {
    calendars: fixturePlan.calendars,
    hidden: new Set<string>(),
    onToggle: fn(),
    onSolo: fn(),
    onManage: fn(),
  },
  argTypes: { hidden: { control: false } },
  render: (args) => <Stateful {...args} />,
} satisfies Meta<typeof CalendarFilter>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const chip = within(canvasElement).getByRole('button', { name: 'Practical Python' })
    await userEvent.click(chip)
    await expect(args.onToggle).toHaveBeenCalledWith('pypy')
    await expect(chip).toHaveAttribute('aria-pressed', 'false')
  },
}

export const SomeHidden: Story = { args: { hidden: new Set(['journey', 'personal']) } }

/** Without `onManage` there is no button for the calendars dialog. */
export const ReadOnly: Story = { args: { onManage: undefined } }
