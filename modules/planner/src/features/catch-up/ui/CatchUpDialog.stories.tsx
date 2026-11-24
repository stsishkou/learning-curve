import { DAY, startOfDay, parseLocal, type Plan } from '@lc/plan-domain'
import { fixtureNow, fixturePlan } from '@lc/plan-domain/fixtures'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { CatchUpDialog } from './CatchUpDialog'

/** The fixture with the sessions of the last `days` days not done, as after time off. */
const behind = (days: number): Plan => ({
  ...fixturePlan,
  events: fixturePlan.events.map((e) => {
    const { done: _done, ...open } = e
    return e.done && parseLocal(e.start) >= startOfDay(fixtureNow) - days * DAY ? open : e
  }),
})

const meta = {
  title: 'Planner/Features/CatchUpDialog',
  component: CatchUpDialog,
  parameters: { dialog: true, docs: { story: { inline: false, iframeHeight: 640 } } },
  args: {
    plan: behind(3),
    open: true,
    now: fixtureNow,
    onChange: fn(async () => {}),
    onShift: fn(),
    onClose: fn(),
  },
  argTypes: { plan: { control: false } },
} satisfies Meta<typeof CatchUpDialog>

export default meta
type Story = StoryObj<typeof meta>

/** Three days were missed: the scenarios are compared by the end of the plan, the deadline and the heaviest week. */
export const AFewDaysBehind: Story = {}

/** Two weeks behind: pushing the plan back now runs past the certificate deadline. */
export const TwoWeeksBehind: Story = { args: { plan: behind(14) } }

/** Nothing is missed: only "leave as it is" is listed and there is nothing to apply. */
export const NothingMissed: Story = { args: { plan: fixturePlan } }
