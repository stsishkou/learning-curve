import { fmtDuration } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'

import { LoggedTimeDialog } from './LoggedTimeDialog'

const MINUTE = 60_000
const title = 'Gemini Certs — Промпты и настройка'

const meta = {
  title: 'Planner/Page/LoggedTimeDialog',
  component: LoggedTimeDialog,
  args: {
    question: { title, planned: 60, minutes: 187, run: { overnight: false } },
    busy: false,
    error: '',
    onLog: fn(),
    onLogAll: fn(),
    onClose: fn(),
  },
} satisfies Meta<typeof LoggedTimeDialog>

export default meta
type Story = StoryObj<typeof meta>

const bodyOf = (canvasElement: HTMLElement) => within(canvasElement.ownerDocument.body)

/**
 * Before a run of more than twice the plan is logged. Nothing is chosen at first, so the counted time is not the
 * default the question is about; the whole run stays one click away.
 */
export const LongRun: Story = {
  play: async ({ canvasElement, args }) => {
    const body = bodyOf(canvasElement)
    await waitFor(() => expect(body.getByText(m.focus_check_title())).toBeVisible())
    await expect(body.getByRole('button', { name: m.save() })).toBeDisabled()
    await userEvent.click(body.getByRole('button', { name: m.spent_over_plan({ time: fmtDuration(30 * MINUTE) }) }))
    await userEvent.click(body.getByRole('button', { name: m.focus_log_time({ time: fmtDuration(90 * MINUTE) }) }))
    await expect(args.onLog).toHaveBeenCalledWith(90)
    await userEvent.click(body.getByRole('button', { name: m.focus_check_all({ time: fmtDuration(187 * MINUTE) }) }))
    await expect(args.onLogAll).toHaveBeenCalled()
  },
}

/** A run that went past midnight says so, however long it was. */
export const Overnight: Story = {
  args: { question: { title, planned: 60, minutes: 50, run: { overnight: true } } },
  play: async ({ canvasElement }) => {
    const body = bodyOf(canvasElement)
    await waitFor(() => expect(body.getByText(new RegExp(m.focus_check_overnight()))).toBeVisible())
  },
}

/** Correcting a logged time: it starts at that time, and Save waits for a different one. */
export const Adjust: Story = {
  args: { question: { title, planned: 60, minutes: 52, run: null } },
  play: async ({ canvasElement, args }) => {
    const body = bodyOf(canvasElement)
    await waitFor(() => expect(body.getByText(m.focus_adjust_title())).toBeVisible())
    await expect(body.getByRole('spinbutton', { name: m.focus_minutes_label() })).toHaveValue(52)
    await expect(body.getByRole('button', { name: m.save() })).toBeDisabled()
    await expect(body.queryByRole('button', { name: m.focus_check_all({ time: fmtDuration(52 * MINUTE) }) })).toBeNull()
    await userEvent.click(body.getByRole('button', { name: m.spent_as_planned() }))
    await userEvent.click(body.getByRole('button', { name: m.focus_log_time({ time: fmtDuration(60 * MINUTE) }) }))
    await expect(args.onLog).toHaveBeenCalledWith(60)
  },
}
