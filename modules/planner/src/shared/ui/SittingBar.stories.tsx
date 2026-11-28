import { m } from '@lc/i18n/messages'
import {
  applyEdits,
  emptyEdits,
  groupBar,
  groupOf,
  parseLocal,
  toLocalString,
  type EventPatch,
  type PlanEvent,
  type SessionGroup,
} from '@lc/plan-domain'
import { fixtureBase, itemAt } from '@lc/plan-domain/fixtures'
import { calendarColor } from '@lc/ui'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'

import { PartMark, SittingBar, sittingLabel } from './SittingBar'

const MINUTE = 60_000
const ROOT = 'certs-001@learning-curve'
const SECOND = 'sitting-2@learning-curve'
const THIRD = 'sitting-3@learning-curve'
const root = itemAt(fixtureBase.events.filter((e) => e.uid === ROOT))

const sitting = (uid: string, start: string, minutes: number, fields: Partial<PlanEvent> = {}): PlanEvent => ({
  ...root,
  uid,
  start,
  end: toLocalString(parseLocal(start) + minutes * MINUTE),
  from: ROOT,
  ...fields,
})

/** The group of the root in a plan where the root is done and unfinished in 25 minutes, and `added` continue it. */
function groupWith(added: PlanEvent[], rootPatch: EventPatch = { done: true, actual: 25, unfinished: true }) {
  const { plan } = applyEdits(fixtureBase, { ...emptyEdits(), events: { [ROOT]: rootPatch }, added })
  const group: SessionGroup | null = groupOf(plan, ROOT)
  if (!group) throw new Error('The root has no group')
  return group
}

const open = groupWith([
  sitting(SECOND, '2026-11-24T18:00', 30, { done: true, actual: 20 }),
  sitting(THIRD, '2026-11-25T18:00', 15),
])
const lone = groupWith([])
const over = groupWith([
  sitting(SECOND, '2026-11-24T18:00', 45, { done: true, actual: 40 }),
  sitting(THIRD, '2026-11-25T18:00', 20),
])

const meta = {
  title: 'Planner/Shared/SittingBar',
  component: SittingBar,
  args: { bar: groupBar(open), label: sittingLabel(open), current: SECOND, size: 'bar' },
  argTypes: { bar: { control: false } },
  decorators: [
    (Story) => (
      <div className="w-80" style={calendarColor('#D0611F')}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SittingBar>

export default meta
type Story = StoryObj<typeof meta>

/** 25 and 20 minutes done, 15 booked; the second sitting is the one being looked at. */
export const Open: Story = {
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('img', { name: m.sitting_progress({ done: 45, total: 60 }) }),
    ).toBeInTheDocument()
  },
}

/** One sitting done and unfinished, the rest of the plan not booked. */
export const LoneUnfinished: Story = {
  args: { bar: groupBar(lone), label: sittingLabel(lone), current: undefined },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('img', { name: m.sitting_progress({ done: 25, total: 60 }) }),
    ).toBeInTheDocument()
  },
}

/** The work passed the first plan by five minutes: a tick marks the plan, the part past it is hatched. */
export const OverPlan: Story = {
  args: { bar: groupBar(over), label: sittingLabel(over), current: undefined },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('img', {
        name: `${m.sitting_progress({ done: 65, total: 85 })}, ${m.sitting_over({ minutes: 5 })}`,
      }),
    ).toBeInTheDocument()
  },
}

/** The thin form for a dashboard row. */
export const Strip: Story = {
  args: { size: 'strip' },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('img', { name: m.sitting_progress({ done: 45, total: 60 }) }),
    ).toBeInTheDocument()
  },
}

/** The mark of a sitting that has siblings. */
export const Part: Story = {
  render: () => <PartMark index={2} count={3} />,
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(m.sitting_part({ index: 2, count: 3 }))).toBeInTheDocument()
  },
}
