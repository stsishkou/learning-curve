import { m } from '@lc/i18n/messages'
import {
  applyChange,
  applyEdits,
  editedUids,
  emptyHistory,
  emptyTrash,
  historyEdits,
  historyView,
  recordChange,
  trashOf,
  travel,
  ymd,
} from '@lc/plan-domain'
import { fixtureEdited, fixturePlan, fixtureWeek } from '@lc/plan-domain/fixtures'
import { fakeFullscreen } from '@lc/ui/testing'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useMemo, useState, type ComponentProps } from 'react'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'

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
    commands: [{ id: 'host', group: 'Host', label: 'A command the host adds', run: fn() }],
  },
  argTypes: { state: { control: false } },
  render: (args) => <Host {...args} />,
} satisfies Meta<typeof PlannerPage>

export default meta
type Story = StoryObj<typeof meta>

/**
 * The page as the app renders it at `/`. A small in-memory host stands in for the app, so editing, the trash and
 * the history all work and nothing is saved. The header slots (`headerAside`, `renderActions`) are empty: the app
 * fills them with the language switcher and the export module. The page follows the real clock, so "today" is
 * marked only when the stand is opened during the fixture's week.
 */
export const Week: Story = {}

export const Month: Story = { args: { search: { week: ymd(fixtureWeek), view: 'month' } } }

export const List: Story = { args: { search: { week: ymd(fixtureWeek), view: 'list' } } }

/** All 24 hours with the calendar expanded to the whole window: the header, the runway and the side panel are hidden. */
export const FullDayExpanded: Story = { args: { search: { week: ymd(fixtureWeek), fullDay: true, expanded: true } } }

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
 * Full screen hides the browser's bars and lays the calendar across all of it, as Expand does; leaving it brings the
 * header back.
 */
export const FullScreen: Story = {
  beforeEach: withScreen(),
  play: async ({ canvasElement }) => {
    const page = within(canvasElement)
    const enter = await page.findByRole('button', { name: m.fullscreen() })
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await userEvent.click(enter)
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
    await within(canvasElement).findByRole('button', { name: m.fullscreen() })
    await userEvent.keyboard('{Shift>}F{/Shift}')
    await expect(screen?.calls.requests).toBe(1)
    await expect(args.onSearchChange).not.toHaveBeenCalledWith(expect.objectContaining({ fullDay: true }))
  },
}

/** Where the browser cannot fill the screen (an iPhone, a frame without leave) there is no full-screen switch. */
export const NoFullScreenWhereTheBrowserCannot: Story = {
  beforeEach: withScreen({ enabled: false }),
  play: async ({ canvasElement }) => {
    const page = within(canvasElement)
    await expect(await page.findByRole('button', { name: m.expand() })).toBeVisible()
    await expect(page.queryByRole('button', { name: m.fullscreen() })).toBeNull()
  },
}
