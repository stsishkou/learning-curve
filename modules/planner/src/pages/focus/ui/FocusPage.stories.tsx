import { m } from '@lc/i18n/messages'
import { isSession } from '@lc/plan-domain'
import { fixtureNow, fixturePlan, itemAt } from '@lc/plan-domain/fixtures'
import { fakeFullscreen } from '@lc/ui/testing'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ComponentProps } from 'react'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'

import { FocusPage } from './FocusPage'

/** Keeps `expanded` the way the app keeps it in the URL. */
function Host(props: ComponentProps<typeof FocusPage>) {
  const [expanded, setExpanded] = useState(props.expanded ?? false)
  return (
    <FocusPage
      {...props}
      expanded={expanded}
      onExpandedChange={(next) => {
        props.onExpandedChange?.(next)
        setExpanded(next)
      }}
    />
  )
}

const meta = {
  title: 'Planner/Page/FocusPage',
  component: FocusPage,
  parameters: { layout: 'fullscreen' },
  args: {
    plan: fixturePlan,
    canEdit: true,
    now: fixtureNow,
    onChange: fn(async () => {}),
    onExpandedChange: fn(),
  },
  argTypes: { plan: { control: false } },
  render: (args) => <Host {...args} />,
} satisfies Meta<typeof FocusPage>

// The stand runs every story in Russian too.
const START = /Start|Resume|Начать|Продолжить/
const PAUSE = /Pause|Пауза/
const FINISH = /Finish|Готово/
const TAKE_BREAK = /Take a break|Сделать перерыв/
const BACK_TO_WORK = /Back to work|Вернуться к работе/

const open = itemAt(fixturePlan.events.filter((e) => isSession(e) && !e.done))

export default meta
type Story = StoryObj<typeof meta>

/**
 * The session in progress, or the next one that is not done, with a stopwatch. `Start` runs it, `Finish` sends one
 * `event.patch` that marks the session done and logs the time in quarter-hour steps.
 */
export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: START }))
    await expect(canvas.getByRole('button', { name: PAUSE })).toBeVisible()
    // A stopwatch that has counted nothing has nothing to log.
    await new Promise<void>((resolve) => setTimeout(() => resolve(), 20))
    await userEvent.click(canvas.getByRole('button', { name: PAUSE }))
    await userEvent.click(canvas.getByRole('button', { name: FINISH }))
    await expect(args.onChange).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'event.patch', patch: { done: true, actual: 15 } }),
    )
  },
}

/** On a read-only host the time can be measured but not logged: there is no `Finish`. */
export const ReadOnly: Story = { args: { canEdit: false } }

/**
 * With breaks of 25 + 5 minutes, 26 minutes in: the break is due. Taking it pauses the stopwatch and counts the rest
 * down; going back to work before it ends runs the stopwatch again.
 */
export const Breaks: Story = {
  args: { session: open.uid },
  beforeEach: () => {
    localStorage.setItem(
      'learning-curve:focus',
      JSON.stringify({ uid: open.uid, banked: 26 * 60_000, startedAt: null }),
    )
    localStorage.setItem('learning-curve:focus-breaks', 'short')
    return () => {
      localStorage.removeItem('learning-curve:focus')
      localStorage.removeItem('learning-curve:focus-breaks')
    }
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: TAKE_BREAK }))
    await expect(canvas.getByText(/Break: 0?5:00|Перерыв: осталось 0?5:00|0?4:5\d/)).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: BACK_TO_WORK }))
    await expect(canvas.getByRole('button', { name: PAUSE })).toBeVisible()
    await expect(canvas.queryByRole('button', { name: TAKE_BREAK })).toBeNull()
  },
}

// The browser's full screen as the story sees it; set up anew before each story that uses it.
let screen: ReturnType<typeof fakeFullscreen> | null = null
const withScreen = () => {
  screen = fakeFullscreen()
  return screen.restore
}

const stopwatchOf = (canvasElement: HTMLElement) => {
  const box = within(canvasElement).getByRole('timer', { name: m.focus_elapsed() }).closest('section')
  if (!box) throw new Error('The stopwatch is not in a section')
  return box
}

/**
 * Expand gives the stopwatch the whole window: the page header goes and the stopwatch reaches the bottom of the
 * window, with the queue still beside it. Collapse brings the page back.
 */
export const ExpandFillsTheWindow: Story = {
  play: async ({ args, canvasElement }) => {
    const page = within(canvasElement)
    await expect(page.getByRole('heading', { level: 1, name: m.focus() })).toBeVisible()
    await userEvent.click(page.getByRole('button', { name: m.expand() }))
    await expect(args.onExpandedChange).toHaveBeenCalledWith(true)
    await waitFor(() => expect(page.queryByRole('heading', { level: 1 })).toBeNull())
    await waitFor(() =>
      expect(window.innerHeight - stopwatchOf(canvasElement).getBoundingClientRect().bottom).toBeLessThan(40),
    )
    await expect(page.getByRole('heading', { name: m.focus_queue() })).toBeVisible()
    await userEvent.click(page.getByRole('button', { name: m.collapse() }))
    await expect(args.onExpandedChange).toHaveBeenLastCalledWith(false)
    await waitFor(() => expect(page.getByRole('heading', { level: 1, name: m.focus() })).toBeVisible())
  },
}

/** Full screen lays the page out as Expand does, across the whole screen; leaving it brings the page back. */
export const FullScreen: Story = {
  beforeEach: withScreen,
  play: async ({ canvasElement }) => {
    const page = within(canvasElement)
    await userEvent.click(page.getByRole('button', { name: m.fullscreen() }))
    await expect(screen?.calls.requests).toBe(1)
    await waitFor(() => expect(page.queryByRole('heading', { level: 1 })).toBeNull())
    await expect(page.queryByRole('button', { name: m.expand() })).toBeNull()
    await userEvent.click(page.getByRole('button', { name: m.fullscreen_exit() }))
    await expect(screen?.calls.exits).toBe(1)
    await waitFor(() => expect(page.getByRole('heading', { level: 1, name: m.focus() })).toBeVisible())
  },
}

/** The planner's keys work here too: E expands, Shift + F fills the screen. */
export const ExpandAndFullScreenByKeys: Story = {
  beforeEach: withScreen,
  play: async ({ args, canvasElement }) => {
    stopwatchOf(canvasElement)
    await userEvent.keyboard('e')
    await expect(args.onExpandedChange).toHaveBeenCalledWith(true)
    await userEvent.keyboard('{Shift>}F{/Shift}')
    await expect(screen?.calls.requests).toBe(1)
  },
}
