import type { Meta, StoryObj } from '@storybook/react-vite'

import { calendarColor } from './calendar-color'
import { ProgressRing } from './progress-ring'

const meta = {
  title: 'UI kit/ProgressRing',
  component: ProgressRing,
  args: { value: 0.3, label: '6 of 20 hours', children: '30%' },
  argTypes: { value: { control: { type: 'range', min: 0, max: 1, step: 0.05 } } },
  decorators: [
    (Story) => (
      <span style={calendarColor('#14897A')}>
        <Story />
      </span>
    ),
  ],
} satisfies Meta<typeof ProgressRing>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** At zero only the track is drawn. */
export const Empty: Story = { args: { value: 0, label: '0 of 20 hours', children: '0%' } }

export const Complete: Story = { args: { value: 1, label: '20 of 20 hours', children: '100%' } }

export const Large: Story = { args: { size: 96, stroke: 10, value: 0.75, children: '75%' } }
