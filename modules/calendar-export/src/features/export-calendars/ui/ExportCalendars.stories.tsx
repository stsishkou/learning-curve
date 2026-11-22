import { fixturePlan } from '@lc/plan-domain/fixtures'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'

import { ExportCalendars } from './ExportCalendars'

const meta = {
  title: 'Calendar export/ExportCalendars',
  component: ExportCalendars,
  parameters: { docs: { story: { inline: false, iframeHeight: 620 } } },
  args: { plan: fixturePlan, hidden: new Set<string>() },
  argTypes: { plan: { control: false }, hidden: { control: false } },
} satisfies Meta<typeof ExportCalendars>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** The dialog after a click on the button: every calendar is checked. */
export const DialogOpen: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button'))
    await expect(canvasElement.querySelector('dialog')).toHaveAttribute('open')
  },
}

/** Calendars hidden in the planner start unchecked, so the export matches what is on screen. */
export const SomeCalendarsHidden: Story = {
  args: { hidden: new Set(['journey', 'personal']) },
  play: DialogOpen.play,
}
