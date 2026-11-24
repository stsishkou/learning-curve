import { fixturePlan } from '@lc/plan-domain/fixtures'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'

import { ExportDialog } from './ExportDialog'

const meta = {
  title: 'Calendar export/ExportDialog',
  component: ExportDialog,
  parameters: { docs: { story: { inline: false, iframeHeight: 620 } } },
  args: { plan: fixturePlan, hidden: new Set<string>(), open: true, onClose: fn() },
  argTypes: { plan: { control: false }, hidden: { control: false } },
} satisfies Meta<typeof ExportDialog>

export default meta
type Story = StoryObj<typeof meta>

/** Every calendar is checked. */
export const Default: Story = {}

/** Calendars hidden in the planner start unchecked, so the export matches what is on screen. */
export const SomeCalendarsHidden: Story = { args: { hidden: new Set(['journey', 'personal']) } }

/** The steps under the list follow the calendar app picked in "Where to". */
export const ForAppleCalendar: Story = {
  play: async ({ canvasElement }) => {
    const dialog = within(canvasElement.ownerDocument.body)
    await userEvent.click(dialog.getByRole('button', { name: /Apple/ }))
    await expect(dialog.getByText(/ Mac: /)).toBeInTheDocument()
  },
}
