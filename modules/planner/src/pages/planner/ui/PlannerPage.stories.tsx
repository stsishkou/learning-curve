import { m } from '@lc/i18n/messages'
import {
  applyChange,
  applyEdits,
  calendarLanes,
  DAY,
  deadlineOf,
  editedUids,
  emptyHistory,
  emptyTrash,
  historyEdits,
  historyView,
  isSession,
  lanesRange,
  nowMinsk,
  parseLocal,
  recordChange,
  toLocalString,
  trashOf,
  travel,
  ymd,
  type Plan,
  type RebalanceResult,
} from '@lc/plan-domain'
import { fixtureEdited, fixtureNow, fixturePlan, fixtureWeek } from '@lc/plan-domain/fixtures'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useMemo, useState, type ComponentProps } from 'react'
import { expect, fireEvent, fn, userEvent, waitFor, within } from 'storybook/test'

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
  // The timeline's place is remembered per browser: every story starts from the default.
  beforeEach: () => localStorage.removeItem('learning-curve:timeline'),
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

const timelineOf = (canvasElement: HTMLElement) => within(canvasElement).queryByRole('region', { name: m.timeline() })

/** The timeline sits under the header; its own menu hides it, and the switch in the ⋮ menu brings it back. */
export const TimelineHiddenAndBack: Story = {
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body)
    const strip = await within(canvasElement).findByRole('region', { name: m.timeline() })
    const header = within(canvasElement).getByText(m.plan_label())
    await expect(header.compareDocumentPosition(strip) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    await userEvent.click(within(strip).getByRole('button', { name: m.timeline_position() }))
    await userEvent.click(await page.findByRole('menuitem', { name: m.timeline_hide() }))
    await waitFor(() => expect(timelineOf(canvasElement)).toBeNull())

    await userEvent.click(page.getByRole('button', { name: m.more_actions() }))
    await userEvent.click(await page.findByRole('menuitemcheckbox', { name: m.timeline() }))
    await expect(await within(canvasElement).findByRole('region', { name: m.timeline() })).toBeVisible()
  },
}

const nothingMoves: RebalanceResult = {
  moves: [],
  report: {
    finish: '2026-12-29',
    finishBefore: '2026-12-30',
    deadline: null,
    peakWeek: 10,
    peakDay: 2,
    overWeeks: [],
    moved: 0,
    late: 0,
    unplaced: 0,
    provenBest: true,
    reasons: [],
  },
}

// The timeline edits from today on: the plan is moved by whole weeks so that its own moment falls in this week.
const weeks = Math.round((nowMinsk() - fixtureNow) / (7 * DAY))
const thisWeek = (at: string) => toLocalString(parseLocal(at) + weeks * 7 * DAY)
const current = (plan: Plan): Plan => ({
  ...plan,
  events: plan.events.map((e) => ({ ...e, start: thisWeek(e.start), end: thisWeek(e.end) })),
})
const editable = (plan: Plan) => ({
  plan,
  canEdit: true,
  edited: fixtureEdited,
  trash: emptyTrash(),
  history: historyView(emptyHistory()),
})
const certsDeadline = deadlineOf(current(fixturePlan), 'certs') ?? ''

/** A deadline moved on its lane is stored at once, and the Undo bar offers to re-balance the course to it. */
export const DeadlineFromTheTimeline: Story = {
  args: { state: editable(current(fixturePlan)), rebalance: fn(async () => nothingMoves) },
  play: async ({ args, canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body)
    const strip = await within(canvasElement).findByRole('region', { name: m.timeline() })
    const deadline = await within(strip).findByRole('slider', { name: m.timeline_deadline({ name: 'Gemini Certs' }) })
    deadline.focus()
    await userEvent.keyboard('{ArrowRight}{Enter}')
    await waitFor(() => expect(args.onChange).toHaveBeenCalledTimes(1))
    await userEvent.click(await page.findByRole('button', { name: m.timeline_rebalance_to_deadline() }))
    await expect(await page.findByRole('checkbox', { name: m.reschedule_finish_by() })).toBeChecked()
    // A day later than before, so finishing by the day before it is finishing by the old deadline.
    await expect(page.getByLabelText(m.reschedule_finish_by(), { selector: 'input[type="date"]' })).toHaveValue(
      certsDeadline,
    )
  },
}

/** Undo the deadline and change something else: the offer goes with the step it belonged to. */
export const OfferBelongsToTheDeadlineStep: Story = {
  args: { state: editable(current(fixturePlan)), rebalance: fn(async () => nothingMoves) },
  play: async ({ args, canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body)
    const strip = await within(canvasElement).findByRole('region', { name: m.timeline() })
    const deadline = await within(strip).findByRole('slider', { name: m.timeline_deadline({ name: 'Gemini Certs' }) })
    deadline.focus()
    await userEvent.keyboard('{ArrowRight}{Enter}')
    const offer = await page.findByRole('button', { name: m.timeline_rebalance_to_deadline() })
    await userEvent.click(within(offer.parentElement ?? offer).getByRole('button', { name: m.undo() }))
    await waitFor(() => expect(args.onTravel).toHaveBeenCalled())
    await userEvent.click(page.getByTitle(m.rename_plan()))
    await userEvent.keyboard('Renamed{Enter}')
    await waitFor(() => expect(args.onChange).toHaveBeenCalledTimes(2))
    await expect(page.queryByRole('button', { name: m.timeline_rebalance_to_deadline() })).toBeNull()
  },
}

// A talk a week after every session of the agents course: moving the course a week puts each session on one.
const agents = current(fixturePlan).events.filter((e) => e.calendar === 'hfagents' && isSession(e))
const talks = agents.map((e, i) => ({
  ...e,
  uid: `talk-${i}`,
  calendar: 'personal',
  title: 'Talk',
  kind: 'personal' as const,
  start: toLocalString(parseLocal(e.start) + 7 * DAY),
  end: toLocalString(parseLocal(e.end) + 7 * DAY),
}))
const withTalks: Plan = { ...current(fixturePlan), events: [...current(fixturePlan).events, ...talks] }

/** A lane dragged a week onto other events is not stored: Reschedule opens with the move and its warnings. */
export const ShiftOntoAnotherEventAsks: Story = {
  args: { state: editable(withTalks) },
  play: async ({ args, canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body)
    const strip = await within(canvasElement).findByRole('region', { name: m.timeline() })
    const lane = await within(strip).findByRole('button', { name: /Hugging Face: AI Agents Course/ })
    const shown = lanesRange(calendarLanes(withTalks, nowMinsk(), new Set()), nowMinsk())
    const days = shown ? (shown.end - shown.start) / DAY : 1
    const box = lane.getBoundingClientRect()
    const week = ((lane.parentElement ?? lane).getBoundingClientRect().width / days) * 7
    const at = { pointerId: 1, pointerType: 'mouse', button: 0, isPrimary: true, clientY: box.top + box.height / 2 }
    const x = box.left + box.width / 2
    await fireEvent.pointerDown(lane, { ...at, clientX: x })
    await fireEvent.pointerMove(lane, { ...at, clientX: x + week * 0.6 })
    await fireEvent.pointerMove(lane, { ...at, clientX: x + week * 1.2 })
    await fireEvent.pointerUp(lane, { ...at, clientX: x + week * 1.2 })
    await expect(await page.findByLabelText(m.shift_days())).toHaveValue(7)
    const today = ymd(nowMinsk())
    const first = agents.filter((e) => !e.done && e.start >= today).toSorted((a, b) => a.start.localeCompare(b.start))
    const overlap = m.ai_warn_overlap({ title: first.at(0)?.title ?? '', other: 'Talk' })
    const warned = await page.findAllByText(overlap)
    await expect(warned.length).toBeGreaterThan(0)
    await expect(args.onChange).not.toHaveBeenCalled()
  },
}
