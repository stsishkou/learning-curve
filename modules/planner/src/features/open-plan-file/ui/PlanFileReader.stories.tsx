import { fixturePlan } from '@lc/plan-domain/fixtures'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'

import { PlanFileReader } from './PlanFileReader'

const meta = {
  title: 'Planner/Features/PlanFileReader',
  component: PlanFileReader,
  parameters: { layout: 'fullscreen', docs: { story: { inline: false, iframeHeight: 720 } } },
  args: {
    open: true,
    shown: { name: 'plan.json', plan: fixturePlan },
    project: fixturePlan,
    onOpen: fn(),
    onClose: fn(),
  },
  argTypes: { shown: { control: false }, project: { control: false } },
} satisfies Meta<typeof PlanFileReader>

export default meta
type Story = StoryObj<typeof meta>

export const Overview: Story = {}

export const Source: Story = {
  play: async ({ canvasElement }) => {
    const dialog = within(canvasElement.ownerDocument.body)
    // The dialog opens in an effect, after the first render: wait for it.
    const [tabs] = await dialog.findAllByRole('group')
    await userEvent.click(within(tabs).getAllByRole('button')[2])
    await expect(dialog.getByText(/"weeklyBudgetHours"/)).toBeInTheDocument()
  },
}
