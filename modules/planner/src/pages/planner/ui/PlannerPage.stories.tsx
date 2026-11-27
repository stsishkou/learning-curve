import { fmtDuration } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import {
  applyChange,
  applyEdits,
  DAY,
  doneWithoutTime,
  editedUids,
  emptyHistory,
  emptyTrash,
  historyEdits,
  historyView,
  isSession,
  occurrences,
  parseLocal,
  recordChange,
  trashOf,
  travel,
  trimHistory,
  ymd,
} from '@lc/plan-domain'
import { fixtureEdited, fixturePlan, fixtureWeek } from '@lc/plan-domain/fixtures'
import { clearIconsOnly, fakeFullscreen } from '@lc/ui/testing'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useMemo, useState, type ComponentProps } from 'react'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'

import type { CalendarSyncSource, CalendarSyncStatus } from '../../../features/calendar-sync'
import { WIDE_PANELS_KEY } from '../model/use-wide-panels'
import { PlannerPage } from './PlannerPage'

/**
 * Stands in for the app: keeps the URL state in memory and stores changes with the same reducer the server uses,
 * so everything on the page works and nothing is saved.
 */
function Host(props: ComponentProps<typeof PlannerPage>) {
  const base = props.state.plan
  const [search, setSearch] = useState(props.search)
  const [history, setHistory] = useState(emptyHistory)
  const edits = historyEdits(history)
  const state = useMemo(
    () => ({
      ...props.state,
      plan: applyEdits(base, edits).plan,
      edited: [...props.state.edited, ...editedUids(edits)],
      trash: trashOf(base, edits),
      history: historyView(history),
    }),
    [props.state, base, edits, history],
  )
  return (
    <PlannerPage
      {...props}
      state={state}
      search={search}
      onSearchChange={(patch) => {
        setSearch((prev) => ({ ...prev, ...patch }))
        props.onSearchChange(patch)
      }}
      onChange={async (change) => {
        await props.onChange(change)
        setHistory((prev) => {
          const before = historyEdits(prev)
          return recordChange(prev, applyEdits(base, before).plan, change, applyChange(base, before, change))
        })
      }}
      onTravel={async (cursor) => {
        await props.onTravel(cursor)
        setHistory((prev) => travel(prev, cursor))
      }}
      onTrimHistory={async () => {
        await props.onTrimHistory()
        setHistory(trimHistory)
      }}
    />
  )
}

const meta = {
  title: 'Planner/Page/PlannerPage',
  component: PlannerPage,
  parameters: {
    layout: 'fullscreen',
    docs: {
      story: { inline: false, iframeHeight: 820 },
    },
  },
  args: {
    state: {
      plan: fixturePlan,
      canEdit: true,
      edited: fixtureEdited,
      trash: emptyTrash(),
      history: historyView(emptyHistory()),
    },
    search: { week: ymd(fixtureWeek) },
    onSearchChange: fn(),
    onChange: fn(async () => {}),
    onTravel: fn(async () => {}),
    onTrimHistory: fn(async () => {}),
    commands: [{ id: 'host', group: 'Host', label: 'A command the host adds', run: fn() }],
  },
  argTypes: { state: { control: false } },
  render: (args) => <Host {...args} />,
} satisfies Meta<typeof PlannerPage>

export default meta
type Story = StoryObj<typeof meta>

/**
 * The page as the app renders it at `/`. A small in-memory host stands in for the app, so editing, the trash and
 * the history all work and nothing is saved. The app's bar, with the sections, Expand and Full screen, is above it
 * in the app and not part of the page. The page follows the real clock, so "today" is marked only when the stand is
 * opened during the fixture's week.
 */
export const Week: Story = {}

export const Month: Story = { args: { search: { week: ymd(fixtureWeek), view: 'month' } } }

export const List: Story = { args: { search: { week: ymd(fixtureWeek), view: 'list' } } }

/**
 * All 24 hours with the calendar expanded to the whole window: the header and the runway are hidden, and the side
 * panels until they are turned on.
 */
export const FullDayExpanded: Story = { args: { search: { week: ymd(fixtureWeek), fullDay: true, expanded: true } } }

const storePanels = (value: string | null) => () => {
  if (value === null) localStorage.removeItem(WIDE_PANELS_KEY)
  else localStorage.setItem(WIDE_PANELS_KEY, value)
  return () => localStorage.removeItem(WIDE_PANELS_KEY)
}
const panel = (root: HTMLElement, name: string) => root.querySelector(`[data-panel="${name}"]`)

/**
 * The expanded calendar opens without its side panels; the side-panel menu brings back Next and Insights one by
 * one, and the choice is remembered. Collapsing shows both again, whatever is remembered for the wide layout.
 */
export const WideSidePanels: Story = {
  beforeEach: storePanels(null),
  args: { search: { week: ymd(fixtureWeek), expanded: true } },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement)
    await expect(panel(canvasElement, 'next')).toBeNull()
    await expect(panel(canvasElement, 'insights')).toBeNull()
    await userEvent.click(page.getByRole('button', { name: m.side_panels() }))
    const insights = await page.findByRole('menuitemcheckbox', { name: m.panel_insights() })
    await expect(insights).toHaveAttribute('aria-checked', 'false')
    await userEvent.click(insights)
    await expect(insights).toHaveAttribute('aria-checked', 'true')
    await waitFor(() => expect(panel(canvasElement, 'insights')).not.toBeNull())
    await expect(panel(canvasElement, 'next')).toBeNull()
    await expect(localStorage.getItem(WIDE_PANELS_KEY)).toBe('["insights"]')
    await userEvent.keyboard('{Escape}')
    await userEvent.click(page.getByRole('button', { name: m.collapse() }))
    await waitFor(() => expect(panel(canvasElement, 'next')).not.toBeNull())
    await expect(panel(canvasElement, 'insights')).not.toBeNull()
  },
}

const insightsHeight = (root: HTMLElement) =>
  Number.parseFloat(
    root.querySelector<HTMLElement>('[data-panel="insights"] section > div:last-child')?.style.maxHeight ?? '',
  )

/**
 * With the whole day on, the calendar already reaches the bottom of the window, so the page keeps its height when
 * Next goes; Insights still takes the room Next leaves.
 */
export const WideInsightsTakesNextsRoom: Story = {
  beforeEach: storePanels('["next","insights"]'),
  args: { search: { week: ymd(fixtureWeek), expanded: true, fullDay: true } },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement)
    await waitFor(() => expect(panel(canvasElement, 'next')).not.toBeNull())
    await waitFor(() => expect(insightsHeight(canvasElement)).toBeGreaterThan(0))
    const before = insightsHeight(canvasElement)
    await userEvent.click(page.getByRole('button', { name: m.side_panels() }))
    await userEvent.click(await page.findByRole('menuitemcheckbox', { name: m.panel_next() }))
    await waitFor(() => expect(panel(canvasElement, 'next')).toBeNull())
    await waitFor(() => expect(insightsHeight(canvasElement)).toBeGreaterThan(before))
  },
}

/** A panel turned on in an earlier visit is there when the expanded calendar opens again. */
export const WideSidePanelsRemembered: Story = {
  beforeEach: storePanels('["next"]'),
  args: { search: { week: ymd(fixtureWeek), expanded: true } },
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(panel(canvasElement, 'next')).not.toBeNull())
    await expect(panel(canvasElement, 'insights')).toBeNull()
  },
}

/** `canEdit: false`, as on a host that cannot write the plan file: nothing on the page changes the plan. */
export const ReadOnly: Story = {
  args: {
    state: {
      plan: fixturePlan,
      canEdit: false,
      edited: [],
      trash: emptyTrash(),
      history: historyView(emptyHistory()),
    },
  },
}

// The browser's full screen as the story sees it; set up anew before each story that uses it.
let screen: ReturnType<typeof fakeFullscreen> | null = null
const withScreen =
  (options: { enabled?: boolean } = {}) =>
  () => {
    screen = fakeFullscreen(options)
    return screen.restore
  }

/**
 * Full screen hides the browser's bars and lays the calendar across all of it, as Expand does, with Exit full screen
 * in the toolbar; leaving it brings the plan's name and the deadline back.
 */
export const FullScreen: Story = {
  beforeEach: withScreen(),
  play: async ({ canvasElement }) => {
    const page = within(canvasElement)
    await expect(await page.findByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.queryByRole('button', { name: m.fullscreen() })).toBeNull()
    await userEvent.keyboard('{Shift>}F{/Shift}')
    await expect(screen?.calls.requests).toBe(1)
    await waitFor(() => expect(page.queryByRole('heading', { level: 1 })).toBeNull())
    await expect(page.queryByRole('button', { name: m.expand() })).toBeNull()
    const leave = page.getByRole('button', { name: m.fullscreen_exit() })
    await expect(leave).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(leave)
    await expect(screen?.calls.exits).toBe(1)
    await waitFor(() => expect(page.getByRole('heading', { level: 1 })).toBeVisible())
  },
}

/** Shift + F switches full screen; F alone still shows the whole day. */
export const FullScreenByKeys: Story = {
  beforeEach: withScreen(),
  play: async ({ args, canvasElement }) => {
    await within(canvasElement).findByRole('button', { name: m.more_actions() })
    await userEvent.keyboard('{Shift>}F{/Shift}')
    await expect(screen?.calls.requests).toBe(1)
    await expect(args.onSearchChange).not.toHaveBeenCalledWith(expect.objectContaining({ fullDay: true }))
  },
}

/** Where the browser cannot fill the screen (an iPhone, a frame without leave) there is no full-screen switch. */
export const NoFullScreenWhereTheBrowserCannot: Story = {
  args: { search: { week: ymd(fixtureWeek), expanded: true } },
  beforeEach: withScreen({ enabled: false }),
  play: async ({ canvasElement }) => {
    const page = within(canvasElement)
    await expect(await page.findByRole('button', { name: m.collapse() })).toBeVisible()
    await expect(page.queryByRole('button', { name: m.fullscreen() })).toBeNull()
  },
}

/**
 * The page has no header of its own: the app's bar holds the sections, Expand and Full screen. The plan's name,
 * which a click renames, and its size open the page, above the deadline and the calendar.
 */
export const PlanNameOpensThePage: Story = {
  play: async ({ canvasElement }) => {
    const page = within(canvasElement)
    const name = await page.findByRole('heading', { level: 1 })
    await expect(name).toHaveTextContent(fixturePlan.meta.title)
    await expect(page.queryByRole('banner')).toBeNull()
    await expect(page.queryByRole('button', { name: m.expand() })).toBeNull()
    const views = page.getAllByRole('group', { name: m.view() })[0]
    await expect(name.getBoundingClientRect().bottom).toBeLessThan(views?.getBoundingClientRect().top ?? 0)
  },
}

const forgetIconsOnly = () => {
  clearIconsOnly()
  return clearIconsOnly
}

/**
 * `Icons only` leaves the toolbar's buttons with their icons: each keeps its name for a screen reader and in its
 * tooltip. The app's bar has the switch on every page; the `⋮` menu has it too, for the expanded calendar.
 */
export const IconsOnly: Story = {
  beforeEach: forgetIconsOnly,
  play: async ({ canvasElement }) => {
    const page = within(canvasElement)
    await userEvent.click(await page.findByRole('button', { name: m.more_actions() }))
    const toggle = await page.findByRole('menuitemcheckbox', { name: m.icons_only() })
    await userEvent.click(toggle)
    await expect(toggle).toHaveAttribute('aria-checked', 'true')
    const event = page.getByRole('button', { name: m.event() })
    await expect(within(event).getByText(m.event()).getBoundingClientRect().width).toBeLessThanOrEqual(1)
  },
}

/** The plan file is opened from the `⋮` menu: the page's top is left to the plan itself. */
export const PlanFileFromTheMenu: Story = {
  play: async ({ canvasElement }) => {
    const page = within(canvasElement)
    await expect(page.queryByRole('button', { name: m.open_plan_file() })).toBeNull()
    await userEvent.click(await page.findByRole('button', { name: m.more_actions() }))
    await userEvent.click(await page.findByRole('menuitem', { name: m.open_plan_file() }))
    const reader = await within(document.body).findByRole('dialog')
    await waitFor(() => expect(within(reader).getByRole('heading', { name: fixturePlan.meta.title })).toBeVisible())
  },
}

const signedOut: CalendarSyncStatus = {
  provider: 'google',
  writable: true,
  configured: true,
  connectedAt: Date.UTC(2026, 10, 1),
  calendars: 2,
  events: 40,
  inbox: [],
  lastRound: Date.UTC(2026, 10, 20),
  takenAt: null,
  error: 'reconnect',
}
const signedOutSource: CalendarSyncSource = {
  status: signedOut,
  connectUrl: '/api/google/connect',
  callbackPath: '/api/google/callback',
  saveClient: fn(async () => {}),
  sync: fn(async () => signedOut),
  accept: fn(async () => signedOut),
  reject: fn(async () => signedOut),
  disconnect: fn(async () => {}),
}

/**
 * The integrations are in the `⋮` menu. When one of them waits for the person, here a calendar app that has to be
 * signed in to again, a dot on `⋮` says so before the menu is opened.
 */
export const IntegrationWaitsOnTheMenu: Story = {
  args: { sync: [signedOutSource] },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement)
    await expect(page.queryByRole('button', { name: m.integrations() })).toBeNull()
    const more = await page.findByRole('button', { name: m.more_actions() })
    await expect(more.querySelector('[data-dot]')).toBeVisible()
    await userEvent.click(more)
    const item = await page.findByRole('menuitem', { name: m.integrations_title() })
    await waitFor(() => expect(item).toBeVisible())
  },
}

const unlogged = fixturePlan.events.filter(doneWithoutTime).toSorted((a, b) => a.start.localeCompare(b.start))

/**
 * Done sessions without a time: a bar counts them and opens the list to fill them in. `fill` in the URL opens the
 * same list, as the dashboard's link does. A time saved takes its session off the count.
 */
export const FillTimes: Story = {
  args: { search: { week: ymd(fixtureWeek), fill: true } },
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    const [first] = unlogged
    const title = await body.findByText(m.log_fill_title({ count: unlogged.length }))
    const dialog = title.closest('dialog')
    if (!first || !dialog) throw new Error('No list of done sessions without a time')
    const [row] = within(dialog).getAllByRole('listitem')
    if (!row) throw new Error('The list has no rows')
    await waitFor(() => expect(row).toBeVisible())
    await userEvent.click(within(row).getByRole('button', { name: m.spent_as_planned() }))
    await userEvent.click(within(dialog).getByRole('button', { name: m.save() }))
    await expect(args.onChange).toHaveBeenCalledWith({
      type: 'events.done',
      uids: [first.uid],
      done: true,
      actual: { [first.uid]: (parseLocal(first.end) - parseLocal(first.start)) / 60_000 },
    })
    await expect(args.onSearchChange).toHaveBeenCalledWith({ fill: undefined })
    await expect(await body.findByText(m.unlogged_bar({ count: unlogged.length - 1 }))).toBeVisible()
  },
}

const doneThisWeek = occurrences(fixturePlan, fixtureWeek, fixtureWeek + 7 * DAY, new Set()).find(
  (o) => isSession(o) && o.done,
)

/**
 * A done session made longer in the grid, here with Alt+Shift+↓: the page asks whether that is the time it took or a
 * new plan, and the time it took is the default.
 */
export const ResizeDoneAsks: Story = {
  play: async ({ args, canvasElement }) => {
    if (!doneThisWeek) throw new Error('No done session in the week')
    const block = canvasElement.querySelector<HTMLElement>(
      `[data-slot="${CSS.escape(`${doneThisWeek.title}@${doneThisWeek.s}`)}"]`,
    )
    if (!block) throw new Error('The done session is not in the grid')
    block.focus()
    await userEvent.keyboard('{Alt>}{Shift>}{ArrowDown}{/Shift}{/Alt}')
    await expect(args.onChange).not.toHaveBeenCalled()
    const longer = (doneThisWeek.e - doneThisWeek.s) / 60_000 + 30
    const body = within(canvasElement.ownerDocument.body)
    await userEvent.click(
      await body.findByRole('button', { name: m.resize_done_time({ time: fmtDuration(longer * 60_000) }) }),
    )
    await expect(args.onChange).toHaveBeenCalledWith({
      type: 'event.patch',
      uid: doneThisWeek.uid,
      patch: { actual: longer },
    })
  },
}
