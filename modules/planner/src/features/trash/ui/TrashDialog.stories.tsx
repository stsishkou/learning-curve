import { emptyTrash } from '@lc/plan-domain'
import { fixturePlan, fixtureTrash } from '@lc/plan-domain/fixtures'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { TrashDialog } from './TrashDialog'

const meta = {
  title: 'Planner/Features/TrashDialog',
  component: TrashDialog,
  parameters: { docs: { story: { inline: false, iframeHeight: 480 } } },
  args: { open: true, plan: fixturePlan, trash: fixtureTrash, onChange: fn(async () => {}), onClose: fn() },
  argTypes: { plan: { control: false }, trash: { control: false } },
} satisfies Meta<typeof TrashDialog>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Empty: Story = { args: { trash: emptyTrash() } }
