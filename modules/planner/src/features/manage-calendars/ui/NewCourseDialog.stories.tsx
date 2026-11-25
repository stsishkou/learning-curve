import { fmtHours } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import { fixtureNow, fixturePlan } from '@lc/plan-domain/fixtures'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'

import { NewCourseDialog } from './NewCourseDialog'

const MODULES = ['Graphs and state — 1h 30m', 'Tools — 1h', 'Lab: A tool-calling agent — 1h 30m'].join('\n')

const meta = {
  title: 'Planner/Features/NewCourseDialog',
  component: NewCourseDialog,
  parameters: { dialog: true, docs: { story: { inline: false, iframeHeight: 900 } } },
  args: { plan: fixturePlan, now: fixtureNow, open: true, onApply: fn(async () => {}), onAdded: fn(), onClose: fn() },
  argTypes: { plan: { control: false } },
} satisfies Meta<typeof NewCourseDialog>

export default meta
type Story = StoryObj<typeof meta>

const bodyOf = (canvasElement: HTMLElement) => within(canvasElement.ownerDocument.body)

/** A pasted module list becomes sessions in the preview; adding the course stores them as one change. */
export const PasteAndAdd: Story = {
  play: async ({ args, canvasElement }) => {
    const body = bodyOf(canvasElement)
    await userEvent.type(await body.findByLabelText(m.course_name()), 'LangGraph')
    await userEvent.type(body.getByLabelText(m.course_modules()), MODULES)
    await expect(
      await body.findByText(
        `${m.course_modules_count({ count: 3 })}, ${fmtHours(5)} · ${m.course_labs({ count: 1 })}`,
        {
          exact: false,
        },
      ),
    ).toBeInTheDocument()
    await expect(await body.findByText(m.course_sessions({ count: 4 }), { exact: false })).toBeInTheDocument()
    await userEvent.click(body.getByRole('button', { name: m.course_add() }))
    await expect(args.onApply).toHaveBeenCalledWith([
      expect.objectContaining({ type: 'course.add', name: 'LangGraph' }),
    ])
    await expect(args.onAdded).toHaveBeenCalled()
    await expect(args.onClose).toHaveBeenCalled()
  },
}

/** A name a calendar already has cannot be added again. */
export const NameTaken: Story = {
  play: async ({ canvasElement }) => {
    const body = bodyOf(canvasElement)
    await userEvent.type(await body.findByLabelText(m.course_name()), fixturePlan.calendars[0]?.name ?? '')
    await userEvent.type(body.getByLabelText(m.course_modules()), MODULES)
    await expect(body.getByText(m.course_name_taken())).toBeInTheDocument()
    await expect(body.getByRole('button', { name: m.course_add() })).toBeDisabled()
  },
}
