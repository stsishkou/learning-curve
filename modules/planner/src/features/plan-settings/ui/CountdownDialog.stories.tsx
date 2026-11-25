import { fmtDay } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import { deadlineChange, deadlineEvent, deadlineOf, parseLocal, type Plan } from '@lc/plan-domain'
import { fixtureNow, fixturePlan } from '@lc/plan-domain/fixtures'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fireEvent, fn, userEvent, within } from 'storybook/test'

import { CountdownDialog } from './CountdownDialog'

const certs = fixturePlan.calendars.find((c) => c.id === 'certs')
const certsDay = deadlineOf(fixturePlan, 'certs') ?? ''
const hfllm = fixturePlan.calendars.find((c) => c.id === 'hfllm')
const following = (calendar: string): Plan => ({ ...fixturePlan, meta: { ...fixturePlan.meta, countdown: calendar } })

const meta = {
  title: 'Planner/Features/CountdownDialog',
  component: CountdownDialog,
  parameters: { dialog: true, docs: { story: { inline: false, iframeHeight: 560 } } },
  args: { plan: fixturePlan, now: fixtureNow, open: true, onApply: fn(async () => {}), onClose: fn() },
  argTypes: { plan: { control: false } },
} satisfies Meta<typeof CountdownDialog>

export default meta
type Story = StoryObj<typeof meta>

const bodyOf = (canvasElement: HTMLElement) => within(canvasElement.ownerDocument.body)

/**
 * Until a course is chosen the days count to the nearest deadline of any course, and the dialog says which one that
 * is now. Choosing a course without a deadline and giving it a day stores both: the course to count to and its
 * deadline, a milestone in its calendar.
 */
export const ChooseACourseAndItsDay: Story = {
  play: async ({ args, canvasElement }) => {
    const body = bodyOf(canvasElement)
    const target = await body.findByRole('combobox', { name: m.countdown_target() })
    await expect(target).toHaveValue('')
    await expect(
      body.getByText(
        m.countdown_nearest_now({ name: certs?.name ?? '', date: fmtDay(parseLocal(`${certsDay}T00:00`)) }),
      ),
    ).toBeInTheDocument()
    await userEvent.selectOptions(target, 'hfllm')
    const day = body.getByLabelText(m.countdown_deadline())
    await expect(day).toHaveValue('')
    await fireEvent.change(day, { target: { value: '2027-02-15' } })
    await userEvent.click(body.getByRole('button', { name: m.save() }))
    await expect(args.onApply).toHaveBeenCalledWith([
      { type: 'plan.countdown', calendar: 'hfllm' },
      deadlineChange(fixturePlan, 'hfllm', '2027-02-15'),
    ])
    await expect(args.onClose).toHaveBeenCalled()
  },
}

/** A course the plan counts to opens with its deadline; removing the day sends the milestone to the trash. */
export const RemoveTheDeadline: Story = {
  args: { plan: following('certs') },
  play: async ({ args, canvasElement }) => {
    const body = bodyOf(canvasElement)
    await expect(await body.findByRole('combobox', { name: m.countdown_target() })).toHaveValue('certs')
    await expect(body.getByLabelText(m.countdown_deadline())).toHaveValue(certsDay)
    await userEvent.click(body.getByRole('button', { name: m.countdown_remove() }))
    await expect(body.getByLabelText(m.countdown_deadline())).toHaveValue('')
    await userEvent.click(body.getByRole('button', { name: m.save() }))
    await expect(args.onApply).toHaveBeenCalledWith([
      { type: 'event.remove', uid: deadlineEvent(fixturePlan, 'certs')?.uid },
    ])
  },
}

/** Going back to the nearest deadline is one change; the deadlines of the courses stay as they are. */
export const BackToTheNearest: Story = {
  args: { plan: following(hfllm?.id ?? 'hfllm') },
  play: async ({ args, canvasElement }) => {
    const body = bodyOf(canvasElement)
    await userEvent.selectOptions(await body.findByRole('combobox', { name: m.countdown_target() }), '')
    await expect(body.queryByLabelText(m.countdown_deadline())).toBeNull()
    await userEvent.click(body.getByRole('button', { name: m.save() }))
    await expect(args.onApply).toHaveBeenCalledWith([{ type: 'plan.countdown', calendar: null }])
  },
}

/** Saving what is already there stores nothing and only closes the dialog. */
export const NothingToStore: Story = {
  play: async ({ args, canvasElement }) => {
    await userEvent.click(await bodyOf(canvasElement).findByRole('button', { name: m.save() }))
    await expect(args.onApply).not.toHaveBeenCalled()
    await expect(args.onClose).toHaveBeenCalled()
  },
}
