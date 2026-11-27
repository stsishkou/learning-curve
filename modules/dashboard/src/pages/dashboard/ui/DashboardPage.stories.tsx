import { m } from '@lc/i18n/messages'
import { fixtureNow, fixturePlan } from '@lc/plan-domain/fixtures'
import { clearIconsOnly, fakeFullscreen } from '@lc/ui/testing'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ComponentProps } from 'react'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'

import { DashboardPage } from './DashboardPage'

/** Keeps `expanded` the way the app keeps it in the URL. */
function Host(props: ComponentProps<typeof DashboardPage>) {
  const [expanded, setExpanded] = useState(props.expanded ?? false)
  return (
    <DashboardPage
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
  title: 'Dashboard/Page/DashboardPage',
  component: DashboardPage,
  parameters: { layout: 'fullscreen' },
  args: { plan: fixturePlan, now: fixtureNow, onExpandedChange: fn() },
  argTypes: { plan: { control: false } },
  render: (args) => <Host {...args} />,
} satisfies Meta<typeof DashboardPage>

export default meta
type Story = StoryObj<typeof meta>

/**
 * The page as the app renders it at `/dashboard`. The app leaves `now` out and the page follows the clock; the
 * story pins it so the picture does not depend on the day it is opened.
 */
export const Default: Story = {}

// The browser's full screen as the story sees it; set up anew before each story that uses it.
let screen: ReturnType<typeof fakeFullscreen> | null = null
const withScreen = () => {
  screen = fakeFullscreen()
  return screen.restore
}

const pageOf = (canvasElement: HTMLElement) => {
  const page = canvasElement.firstElementChild
  if (!(page instanceof HTMLElement)) throw new Error('The page is not rendered')
  return page
}

/**
 * The page has no header of its own: the app's bar names it and holds Expand and Full screen. It still says what it
 * is to a screen reader.
 */
export const NoHeaderOfItsOwn: Story = {
  play: async ({ canvasElement }) => {
    const page = within(canvasElement)
    await expect(page.queryByRole('banner')).toBeNull()
    await expect(page.getByRole('heading', { level: 1, name: m.dashboard() })).toBeInTheDocument()
    await expect(page.queryByRole('button', { name: m.expand() })).toBeNull()
    await expect(page.queryByRole('button', { name: m.fullscreen() })).toBeNull()
  },
}

/**
 * Expand gives the charts the whole window: the page is no longer held to a column in the middle, and the plan's
 * name and end stay above the charts, beside Collapse, which brings the page back.
 */
export const ExpandSpreadsTheCharts: Story = {
  play: async ({ args, canvasElement }) => {
    const page = within(canvasElement)
    await page.findByText(fixturePlan.meta.title, { exact: false })
    await userEvent.keyboard('e')
    await expect(args.onExpandedChange).toHaveBeenCalledWith(true)
    await waitFor(() => expect(getComputedStyle(pageOf(canvasElement)).maxWidth).toBe('none'))
    await expect(page.getByText(fixturePlan.meta.title, { exact: false })).toBeVisible()
    await userEvent.click(page.getByRole('button', { name: m.collapse() }))
    await expect(args.onExpandedChange).toHaveBeenLastCalledWith(false)
    await waitFor(() => expect(page.queryByRole('button', { name: m.collapse() })).toBeNull())
  },
}

/** Expanded, the bar with the plan's name and Collapse stays at the top while the charts scroll under it. */
export const ExpandedKeepsItsBar: Story = {
  args: { expanded: true },
  play: async ({ canvasElement }) => {
    const collapse = within(canvasElement).getByRole('button', { name: m.collapse() })
    window.scrollTo(0, document.documentElement.scrollHeight)
    await waitFor(() => expect(window.scrollY).toBeGreaterThan(200))
    await expect(collapse.getBoundingClientRect().top).toBeGreaterThanOrEqual(0)
    await expect(collapse.getBoundingClientRect().bottom).toBeLessThan(80)
    window.scrollTo(0, 0)
  },
}

/** Full screen lays the page out as Expand does, across the whole screen; leaving it brings the page back. */
export const FullScreen: Story = {
  beforeEach: withScreen,
  play: async ({ canvasElement }) => {
    const page = within(canvasElement)
    await page.findByText(fixturePlan.meta.title, { exact: false })
    await userEvent.keyboard('{Shift>}F{/Shift}')
    await expect(screen?.calls.requests).toBe(1)
    await expect(page.queryByRole('button', { name: m.expand() })).toBeNull()
    await userEvent.click(await page.findByRole('button', { name: m.fullscreen_exit() }))
    await expect(screen?.calls.exits).toBe(1)
    await waitFor(() => expect(page.queryByRole('button', { name: m.fullscreen_exit() })).toBeNull())
  },
}

/** The planner's keys work here too: E expands, Shift + F fills the screen. */
export const ExpandAndFullScreenByKeys: Story = {
  beforeEach: withScreen,
  play: async ({ args, canvasElement }) => {
    await within(canvasElement).findByText(fixturePlan.meta.title, { exact: false })
    await userEvent.keyboard('e')
    await expect(args.onExpandedChange).toHaveBeenCalledWith(true)
    await userEvent.keyboard('{Shift>}F{/Shift}')
    await expect(screen?.calls.requests).toBe(1)
  },
}

/** In the icons-only mode Collapse and Exit full screen keep their icons, named in their tooltips. */
export const IconsOnly: Story = {
  args: { expanded: true },
  // As the app's head script sets it.
  beforeEach: () => {
    document.documentElement.setAttribute('data-icons', 'only')
    return clearIconsOnly
  },
  play: async ({ canvasElement }) => {
    const collapse = within(canvasElement).getByRole('button', { name: m.collapse() })
    await expect(within(collapse).getByText(m.collapse()).getBoundingClientRect().width).toBeLessThanOrEqual(1)
  },
}
