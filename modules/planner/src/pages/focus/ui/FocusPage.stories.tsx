import { m } from '@lc/i18n/messages'
import { isSession, parseLocal } from '@lc/plan-domain'
import { fixtureNow, fixturePlan, itemAt } from '@lc/plan-domain/fixtures'
import { clearIconsOnly, fakeFullscreen } from '@lc/ui/testing'
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
const MINUTE = 60_000
const planned = parseLocal(open.end) - parseLocal(open.start)

const FOCUS_KEYS = ['learning-curve:focus', 'learning-curve:focus-breaks', 'learning-curve:focus-glass']
const clearFocus = () => {
  for (const key of FOCUS_KEYS) localStorage.removeItem(key)
}
const fresh = () => {
  clearFocus()
  return clearFocus
}
/** The stopwatch of the open session, paused at `banked` ms */
const timing = (banked: number) =>
  localStorage.setItem('learning-curve:focus', JSON.stringify({ uid: open.uid, banked, startedAt: null }))
const stored = (key: string): unknown => JSON.parse(localStorage.getItem(key) ?? 'null')
const glassOf = (canvasElement: HTMLElement) => {
  const glass = canvasElement.querySelector('canvas')
  if (!glass) throw new Error('No hourglass')
  return glass
}
const timerOf = (canvasElement: HTMLElement) => within(canvasElement).getByRole('timer', { name: m.focus_elapsed() })

export default meta
type Story = StoryObj<typeof meta>

/**
 * The session in progress, or the next one that is not done, with a stopwatch. `Start` runs it, `Finish` sends one
 * `session.finish` that marks the session done and logs the time in whole minutes, with the real start and pauses.
 */
export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: START }))
    await expect(canvas.getByRole('button', { name: PAUSE })).toBeVisible()
    // A stopwatch that has counted almost nothing logs the least a session may take.
    await new Promise<void>((resolve) => setTimeout(() => resolve(), 20))
    await userEvent.click(canvas.getByRole('button', { name: PAUSE }))
    await userEvent.click(canvas.getByRole('button', { name: FINISH }))
    await expect(args.onChange).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'session.finish', actual: 5, paused: 0 }),
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

/** In the icons-only mode the stopwatch's buttons show only their icons; their names stay for a screen reader. */
export const IconsOnly: Story = {
  beforeEach: () => {
    clearIconsOnly()
    localStorage.setItem('lc-icons-only', '1')
    return clearIconsOnly
  },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement)
    await waitFor(() =>
      expect(page.getByRole('button', { name: m.icons_only() })).toHaveAttribute('aria-pressed', 'true'),
    )
    const start = page.getByRole('button', { name: START })
    await expect(within(start).getByText(START).getBoundingClientRect().width).toBeLessThanOrEqual(1)
  },
}

/**
 * The hourglass stands beside the digits, above them on a phone, and holds the planned session: the sand in the
 * top is the time left.
 */
export const TheGlassBesideTheDigits: Story = {
  args: { session: open.uid },
  beforeEach: fresh,
  play: async ({ canvasElement }) => {
    const glass = await waitFor(() => glassOf(canvasElement))
    await waitFor(() => expect(glass.getBoundingClientRect().height).toBeGreaterThan(100))
    const box = glass.getBoundingClientRect()
    const digits = timerOf(canvasElement).getBoundingClientRect()
    if (window.innerWidth >= 701) await expect(box.right).toBeLessThanOrEqual(digits.left)
    else await expect(box.bottom).toBeLessThanOrEqual(digits.top)
  },
}

/** A break being taken is kept: a reload finds it counting down by the wall clock, with the stopwatch paused. */
export const ABreakSurvivesAReload: Story = {
  args: { session: open.uid },
  beforeEach: () => {
    clearFocus()
    timing(25 * MINUTE)
    localStorage.setItem('learning-curve:focus-breaks', 'short')
    localStorage.setItem(
      'learning-curve:focus-glass',
      JSON.stringify({ uid: open.uid, from: 25 * MINUTE, restUntil: Date.now() + 3 * MINUTE, rest: 5 * MINUTE }),
    )
    return clearFocus
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText(/0?2:5\d/)).toBeVisible()
    await expect(canvas.getByRole('button', { name: BACK_TO_WORK })).toBeVisible()
    await expect(canvas.queryByRole('button', { name: TAKE_BREAK })).toBeNull()
  },
}

/** "Later" is kept too: after a reload the skipped break is not due again, and the next one is a whole block on. */
export const ASkippedBreakStaysSkipped: Story = {
  args: { session: open.uid },
  beforeEach: () => {
    clearFocus()
    timing(30 * MINUTE)
    localStorage.setItem('learning-curve:focus-breaks', 'short')
    localStorage.setItem(
      'learning-curve:focus-glass',
      JSON.stringify({ uid: open.uid, from: 27 * MINUTE, restUntil: null, rest: 0 }),
    )
    return clearFocus
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText(m.focus_break_in({ minutes: 22 }))).toBeVisible()
    await expect(canvas.queryByRole('button', { name: TAKE_BREAK })).toBeNull()
  },
}

/** A rhythm of your own. The minutes are stored when a field is left or Enter is pressed, not while typing. */
export const ACustomRhythm: Story = {
  args: { session: open.uid },
  beforeEach: fresh,
  play: async ({ canvasElement }) => {
    const page = within(canvasElement)
    await userEvent.click(await page.findByRole('button', { name: m.focus_glass_custom() }))
    const work = page.getByLabelText(m.focus_glass_work())
    await expect(work).toHaveValue(30)
    await userEvent.clear(work)
    await userEvent.type(work, '40')
    await expect(stored('learning-curve:focus-breaks')).toMatchObject({ work: 30 })
    await userEvent.keyboard('{Enter}')
    await expect(page.getByText(m.focus_break_in({ minutes: 40 }))).toBeVisible()
    await expect(stored('learning-curve:focus-breaks')).toMatchObject({ mode: 'custom', work: 40, rest: 5 })
  },
}

/** The glass can be hidden, and stays hidden: the digits are then alone, with the bar of the session under them. */
export const HideTheGlass: Story = {
  beforeEach: fresh,
  play: async ({ canvasElement }) => {
    const page = within(canvasElement)
    await waitFor(() => glassOf(canvasElement))
    await userEvent.click(page.getByRole('button', { name: m.focus_glass_hide() }))
    await expect(canvasElement.querySelector('canvas')).toBeNull()
    await expect(stored('learning-curve:focus-breaks')).toMatchObject({ hidden: true })
    await userEvent.click(page.getByRole('button', { name: m.focus_glass_show() }))
    await waitFor(() => glassOf(canvasElement))
  },
}

/** While the sand falls, the tab's title starts with the minutes left; a pause gives the title back. */
export const TheTitleCountsDown: Story = {
  args: { session: open.uid },
  beforeEach: () => {
    clearFocus()
    const title = document.title
    return () => {
      clearFocus()
      document.title = title
    }
  },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement)
    const base = document.title
    await userEvent.click(await page.findByRole('button', { name: START }))
    await waitFor(() => expect(document.title).toBe(`${m.focus_title_left({ minutes: planned / MINUTE })} · ${base}`))
    await userEvent.click(page.getByRole('button', { name: PAUSE }))
    await waitFor(() => expect(document.title).toBe(base))
  },
}

/** Expand makes the watch the centre of the screen: the glass takes the height and the digits grow with it. */
export const ExpandGrowsTheWatch: Story = {
  beforeEach: fresh,
  play: async ({ canvasElement }) => {
    const page = within(canvasElement)
    const glass = await waitFor(() => glassOf(canvasElement))
    await waitFor(() => expect(glass.getBoundingClientRect().height).toBeGreaterThan(0))
    const before = {
      glass: glass.getBoundingClientRect().height,
      digits: Number.parseFloat(getComputedStyle(timerOf(canvasElement)).fontSize),
    }
    await userEvent.click(page.getByRole('button', { name: m.expand() }))
    await waitFor(() => expect(glassOf(canvasElement).getBoundingClientRect().height).toBeGreaterThan(before.glass))
    if (window.innerWidth >= 701) {
      await expect(Number.parseFloat(getComputedStyle(timerOf(canvasElement)).fontSize)).toBeGreaterThan(before.digits)
    }
  },
}
