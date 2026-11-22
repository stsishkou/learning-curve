import { parseLocal } from '@lc/plan-domain'
import { fixtureNow, fixturePlan } from '@lc/plan-domain/fixtures'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { Runway } from './Runway'

const meta = {
  title: 'Planner/Widgets/Runway',
  component: Runway,
  args: { plan: fixturePlan, now: fixtureNow, onSelect: fn() },
  argTypes: { plan: { control: false } },
} satisfies Meta<typeof Runway>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const LastWeek: Story = { args: { now: parseLocal('2026-12-28T10:00') } }

export const AfterTheDeadline: Story = { args: { now: parseLocal('2027-01-12T10:00') } }
