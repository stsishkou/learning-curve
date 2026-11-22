import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ComponentProps } from 'react'
import { expect, fn, userEvent, within } from 'storybook/test'

import { Segmented } from './segmented'

function Stateful(props: ComponentProps<typeof Segmented>) {
  const [value, setValue] = useState(props.value)
  return <Segmented {...props} value={value} onChange={(next) => (setValue(next), props.onChange(next))} />
}

const meta = {
  title: 'UI kit/Segmented',
  component: Segmented,
  args: {
    label: 'View',
    value: 'week',
    options: [
      { value: 'week', label: 'Week' },
      { value: 'month', label: 'Month' },
      { value: 'list', label: 'List' },
    ],
    onChange: fn(),
  },
  render: (args) => <Stateful {...args} />,
} satisfies Meta<typeof Segmented>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const month = within(canvasElement).getByRole('button', { name: 'Month' })
    await userEvent.click(month)
    await expect(args.onChange).toHaveBeenCalledWith('month')
    await expect(month).toHaveAttribute('aria-pressed', 'true')
  },
}

/** Each option carries its own `lang`, so a screen reader says the label in that language. */
export const Languages: Story = {
  args: {
    label: 'Language',
    value: 'ru',
    options: [
      { value: 'ru', label: 'RU', lang: 'ru' },
      { value: 'en', label: 'EN', lang: 'en' },
      { value: 'es', label: 'ES', lang: 'es' },
    ],
  },
}
